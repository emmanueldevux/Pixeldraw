// ============================================================
// UXLLY — Render one slideshow photo
// A real-phone-photo look. When a character is used, its photos go to the
// image model as identity references so the same person appears on every
// slide. No words in the image: text is added in the editor.
// ============================================================
import { toFile } from "openai";
import { getClient, withRetry } from "@/lib/ai/providers/openai";
import type { Character } from "./types";

const REALISM =
  "A genuine, unedited smartphone photo (iPhone camera): natural available light, honest colours, slightly imperfect framing, true-to-life skin and textures with visible pores and small flaws, natural depth of field, a hint of phone-camera sharpening. Not an ad, not stock photography, not a render, no airbrushed or plastic look, no HDR glow, no cinematic colour grading.";

const NO_TEXT = "The photo contains NO text, no readable signs, no captions, no watermarks and no logos. Keep the top quarter of the frame calm and uncluttered (a caption is added there later).";

async function asFile(src: string, name: string) {
  let buf: Buffer;
  let type = "image/png";
  if (src.startsWith("data:")) {
    type = src.slice(5, src.indexOf(";")) || type;
    buf = Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  } else {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`Could not load a reference (${r.status})`);
    type = r.headers.get("content-type") || type;
    buf = Buffer.from(await r.arrayBuffer());
  }
  const ext = type.includes("jpeg") || type.includes("jpg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  return toFile(buf, `${name}.${ext}`, { type });
}

export function slideshowQuality(): "low" | "medium" | "high" | "auto" {
  return ((process.env.OPENAI_IMAGE_QUALITY_SLIDESHOW || "high") as "low" | "medium" | "high" | "auto");
}

export async function renderPhoto(opts: {
  scene: string;
  person: "character" | "anonymous" | "none";
  character: Character | null;
  styleDna: string;
  landscape: boolean; // 2-in-1 halves are 3:2
}): Promise<{ url: string; usedCharacter: boolean }> {
  const useChar = opts.person === "character" && !!opts.character && opts.character.photos.length > 0;
  const lines = [
    "Create ONE photograph.",
    REALISM,
    useChar
      ? `The attached image${opts.character!.photos.length > 1 ? "s show" : " shows"} the SAME PERSON (${opts.character!.name}). The person in the new photo must be clearly this exact person: same face, hair, skin tone, age and build. Do not copy the pose, outfit or background of the attached photos; follow the scene below. ${opts.character!.description ? "About them: " + opts.character!.description : ""}`
      : opts.person === "anonymous"
        ? "If a person appears, show them only from behind, in silhouette, or as hands/feet; do not show a clear face."
        : opts.person === "none"
          ? "No people in this photo."
          : "",
    "",
    "SCENE:",
    opts.scene,
    opts.styleDna ? `\nSTYLE (follow the look and feel, not specific content):\n${opts.styleDna.slice(0, 1800)}` : "",
    "",
    NO_TEXT,
  ].filter((l) => l !== "");
  const prompt = lines.join("\n");

  const client = getClient();
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const size = opts.landscape ? "1536x1024" : "1024x1536";
  const quality = slideshowQuality();
  const res = useChar
    ? await withRetry(async () => {
        const files = await Promise.all(opts.character!.photos.slice(0, 3).map((p, i) => asFile(p, `person${i + 1}`)));
        return client.images.edit({ model, image: files, prompt, n: 1, size, quality });
      })
    : await withRetry(() => client.images.generate({ model, prompt, n: 1, size, quality }));
  const d = res.data?.[0] as Record<string, unknown> | undefined;
  const url = d?.url ? String(d.url) : d?.b64_json ? `data:image/png;base64,${d.b64_json}` : "";
  if (!url) throw new Error("No image returned");
  return { url, usedCharacter: useChar };
}
