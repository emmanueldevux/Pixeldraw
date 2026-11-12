// ============================================================
// UXLLY — Make an AI character for the character sheet
// POST { name, description } → { photos: [url, url] }  (a face shot and a half-body shot)
// The person is invented from the description (not a real person).
// ============================================================
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withUsage } from "@/lib/billing/usage";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { insufficientResponse, requireUser, unauthorized } from "@/lib/billing/http";
import { getClient, withRetry } from "@/lib/ai/providers/openai";
import { slideshowQuality } from "@/lib/slideshow/render";
import { finishSlide } from "@/lib/slideshow/finish";
import { persistImage } from "@/lib/generations";
import { db } from "@/lib/db";
import { cleanCharacters } from "@/lib/slideshow/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SHOTS = [
  { size: "1024x1536" as const, text: "A natural front-facing portrait from the chest up, soft window light, relaxed friendly expression, plain softly blurred home background." },
  { size: "1024x1536" as const, text: "A natural half-body candid, three-quarter angle, standing in a bright everyday setting, looking slightly off camera." },
];

async function handlePOST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const description = typeof b.description === "string" ? b.description.trim().slice(0, 700) : "";
  if (description.length < 10) return NextResponse.json({ error: "Describe the person: age, hair, style, vibe." }, { status: 400 });

  let auth;
  try {
    auth = await authorize(user.id, [{ key: "image.openai", qty: SHOTS.length }], { trial: "none" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return insufficientResponse(e);
    throw e;
  }
  try {
    const client = getClient();
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const photos: string[] = [];
    // First shot defines the person; the second is generated as an edit of it so the face matches.
    for (let i = 0; i < SHOTS.length; i++) {
      const prompt = `A genuine unedited smartphone photo (iPhone), natural light, true-to-life skin with visible pores, not airbrushed, not an ad. An invented, fictional adult person: ${description}. ${SHOTS[i].text} No text, no logos, no watermark.`;
      let res;
      if (i === 0) {
        res = await withRetry(() => client.images.generate({ model, prompt, n: 1, size: SHOTS[i].size, quality: slideshowQuality() }));
      } else {
        const first = photos[0];
        const buf = Buffer.from(first.slice(first.indexOf(",") + 1), "base64");
        const { toFile } = await import("openai");
        res = await withRetry(async () =>
          client.images.edit({ model, image: await toFile(buf, "first.jpg", { type: "image/jpeg" }), prompt: `${prompt} It must be exactly the same person as in the attached photo (same face, hair, skin tone, age and build).`, n: 1, size: SHOTS[i].size, quality: slideshowQuality() }),
        );
      }
      const d = res.data?.[0] as Record<string, unknown> | undefined;
      const raw = d?.url ? String(d.url) : d?.b64_json ? `data:image/png;base64,${d.b64_json}` : "";
      if (!raw) throw new Error("No image returned");
      photos.push(await finishSlide(raw, "3:4"));
    }
    const urls = await Promise.all(photos.map((p) => persistImage(p, "characters")));
    await commit(user.id, auth, [{ key: "image.openai", qty: SHOTS.length }], { ref: randomUUID(), producedImage: true, note: "Character sheet" }).catch((e) => console.error("[CHARACTER] billing failed:", e));
    return NextResponse.json({ success: true, photos: urls });
  } catch (e) {
    console.error("[CHARACTER] failed:", e);
    return NextResponse.json({ error: "The character couldn't be made. You were not charged. Try again." }, { status: 502 });
  }
}
export const POST = withUsage(handlePOST);

// ---- the project's characters (read / replace) ----
async function owned(userId: string, brandId: string) {
  return db.brand.findFirst({ where: { id: brandId, userId }, include: { styleGuide: true } });
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const brandId = new URL(request.url).searchParams.get("brandId") || "";
  const brand = await owned(user.id, brandId);
  if (!brand) return NextResponse.json({ characters: [] });
  const adv = ((brand.styleGuide as unknown as { advancedSettings?: Record<string, unknown> } | null)?.advancedSettings) || {};
  return NextResponse.json({ characters: cleanCharacters(adv.characters) });
}

/** PUT { brandId, characters[] } replaces the project's characters, keeping every other setting. */
export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const brand = typeof b.brandId === "string" ? await owned(user.id, b.brandId) : null;
  if (!brand || !brand.styleGuide) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const adv = ((brand.styleGuide as unknown as { advancedSettings?: Record<string, unknown> }).advancedSettings) || {};
  const characters = cleanCharacters(b.characters);
  await db.styleGuide.update({ where: { id: brand.styleGuide.id }, data: { advancedSettings: { ...adv, characters } as never } });
  return NextResponse.json({ success: true, characters });
}
