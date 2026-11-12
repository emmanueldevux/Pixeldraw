// ============================================================
// UXLLY — Saved generations
// Every finished design is uploaded to storage (R2) and recorded, so it
// survives a refresh, shows in the dashboard's Files tab, and feeds the
// learning loop (downloads / redos per reference).
// ============================================================
import { db } from "@/lib/db";
import { uploadImage, uploadFromUrl } from "@/lib/storage";

/** Upload a generated image (data URL or temporary URL) to R2. Falls back to the original on error. */
export async function persistImage(url: string, folder = "generated"): Promise<string> {
  if (!url) return url;
  if (process.env.R2_PUBLIC_URL && url.startsWith(process.env.R2_PUBLIC_URL)) return url; // already ours
  try {
    if (url.startsWith("data:")) {
      const type = url.slice(5, url.indexOf(";")) || "image/png";
      return await uploadImage(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"), type, folder);
    }
    return await uploadFromUrl(url, folder);
  } catch (e) {
    console.warn("[GENERATIONS] upload failed, keeping the original URL:", (e as Error).message);
    return url;
  }
}

export interface SaveGenerationInput {
  userId: string;
  brandId?: string | null;
  kind: "image" | "carousel" | "template";
  title?: string;
  imageUrls: string[];
  caption?: string | null;
  prompt?: string | null;
  meta?: Record<string, unknown>;
}

/** Persist every image, then record the generation. Returns the stored URLs (same order). */
export async function saveGeneration(input: SaveGenerationInput): Promise<{ id: string | null; imageUrls: string[] }> {
  const imageUrls = await Promise.all(input.imageUrls.map((u) => (u ? persistImage(u) : Promise.resolve(u))));
  try {
    const row = await db.generation.create({
      data: {
        userId: input.userId,
        brandId: input.brandId || null,
        kind: input.kind,
        title: (input.title || "").slice(0, 200),
        // never store raw image data in the database
        imageUrls: imageUrls.filter((u) => u && !u.startsWith("data:")),
        caption: input.caption ? input.caption.slice(0, 5000) : null,
        prompt: input.prompt ? input.prompt.slice(0, 5000) : null,
        meta: (input.meta ?? undefined) as never,
      },
    });
    return { id: row.id, imageUrls };
  } catch (e) {
    console.warn("[GENERATIONS] could not record generation:", (e as Error).message);
    return { id: null, imageUrls };
  }
}
