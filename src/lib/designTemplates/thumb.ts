// ============================================================
// UXLLY — Thumbnail brain
//
// Same idea as single ads, a different job: a thumbnail is a scroll-stopping
// picture, mostly landscape, with NO text unless the user asks for it.
//   - packs: reference thumbnails (a DesignTemplate of kind "pack" whose
//     category is "Thumbnails") studied for composition, expression and colour
//   - subject: the user's attached photo, else their character sheet, else an
//     AI-made subject that fits the topic
//   - size: the user's choice (16:9, 1.91:1, 3:2, 4:3, 1:1, 4:5); default 16:9
// ============================================================
import sharp from "sharp";
import { toFile } from "openai";
import { getClient, withRetry, getImageQuality } from "@/lib/ai/providers/openai";
import { pickReference } from "./pack";
import { adjustPick, packRefScores } from "@/lib/learning";
import { trimToAspect } from "./crop";
import type { DesignTemplate } from "./types";

// ==================== Sizes ====================

export const THUMB_SIZES: Record<string, { w: number; h: number; label: string }> = {
  "16:9": { w: 1280, h: 720, label: "16:9 (YouTube)" },
  "1.91:1": { w: 1200, h: 630, label: "1.91:1 (blog, link preview)" },
  "3:2": { w: 1200, h: 800, label: "3:2" },
  "4:3": { w: 1200, h: 900, label: "4:3" },
  "1:1": { w: 1080, h: 1080, label: "1:1 (square)" },
  "4:5": { w: 1080, h: 1350, label: "4:5 (portrait)" },
};
export type ThumbSpec = { aspect: string; w: number; h: number };

export function isThumbnailRequest(message: string, platform?: string): boolean {
  return /\b(thumbnails?|thumbs?)\b/i.test(message) || platform === "youtube_thumbnail";
}

/** Read the size from the message ("16:9", "1200x630", "blog cover", "square"…). Default 16:9. */
export function thumbSpec(message: string): ThumbSpec {
  const m = message.toLowerCase();
  const pick = (a: string): ThumbSpec => ({ aspect: a, w: THUMB_SIZES[a].w, h: THUMB_SIZES[a].h });
  if (/1\.91|1200\s*[x×]\s*630|\bog\b/.test(m)) return pick("1.91:1");
  if (/\b4\s*[:/x]\s*5\b|portrait/.test(m)) return pick("4:5");
  if (/\b3\s*[:/x]\s*2\b/.test(m)) return pick("3:2");
  if (/\b4\s*[:/x]\s*3\b/.test(m)) return pick("4:3");
  if (/\b1\s*[:/x]\s*1\b|square/.test(m)) return pick("1:1");
  if (/\b16\s*[:/x]\s*9\b|youtube|1280\s*[x×]\s*720/.test(m)) return pick("16:9");
  if (/\bblog|article|newsletter|link preview/.test(m)) return pick("1.91:1");
  return pick("16:9");
}

// ==================== Text: none unless asked ====================

export type ThumbText = { mode: "none" } | { mode: "exact"; text: string } | { mode: "write" };

export function thumbText(message: string): ThumbText {
  const wants = /\b(add|with|include|put|write|use)\b[^.\n]{0,30}\b(text|title|words?|headline|caption|lettering)\b|\b(that )?says?\b|\btext (on|in|saying)\b/i.test(message);
  if (!wants) return { mode: "none" };
  const q = message.match(/["“”‘’']([^"“”‘’']{2,60})["“”‘’']/);
  return q ? { mode: "exact", text: q[1].trim() } : { mode: "write" };
}

// ==================== Study ====================

export async function studyThumbPack(refs: string[]): Promise<{ packDna: string; refDnas: string[] }> {
  const images = refs.slice(0, 8);
  if (!images.length) throw new Error("Add at least one reference thumbnail first");
  const client = getClient();
  const model = process.env.OPENAI_DNA_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-4o";
  const prompt = `You are a senior thumbnail art director. The ${images.length} attached image${images.length > 1 ? "s are" : " is"} a pack of reference THUMBNAILS (numbered 1 to ${images.length} in order).
Write what a designer or image model needs to make NEW thumbnails for OTHER topics with the same pull and quality. Describe the system, never the specific people, brands or words in the references.

Return ONLY JSON:
{
  "packDna": "What all of them share: overall look, how the subject is framed and cropped, background treatment, lighting and depth, colour strategy and contrast, any glows, outlines or cut-out edges, props or graphic elements, how busy or clean they are, finish quality, and DON'Ts. 150-300 words, plain text.",
  "refs": [
    { "dna": "Thumbnail N only: composition with % positions (where the main subject sits and how big, where the second element, empty space and focal point are, any arrows/shapes/overlays), the subject's expression, pose and energy, and the colour and contrast treatment (dominant colours, glow, rim light, background). 80-140 words.", "mood": "3-6 adjectives for the feeling it gives, e.g. 'shocked, high-energy, bold' or 'calm, clean, trustworthy'", "bestFor": "topics this thumbnail style suits, e.g. 'tutorials and how-tos' or 'reaction, drama, big reveal' or 'finance, money, business' or 'travel, lifestyle, vlogs'" }
  ]
}
One entry in "refs" per image, in the same order.`;
  const res = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 4000,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } }))] }],
  });
  const text = res.choices[0]?.message?.content || "";
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("The AI didn't return a DNA. Try again.");
  const j = JSON.parse(text.slice(a, b + 1)) as { packDna?: string; refs?: { dna?: string; mood?: string; bestFor?: string }[] };
  const refDnas = images.map((_, i) => {
    const r = j.refs?.[i];
    return r ? `${r.dna || ""}${r.mood ? `\nMOOD: ${r.mood}` : ""}${r.bestFor ? `\nBEST FOR: ${r.bestFor}` : ""}`.trim() : "";
  });
  return { packDna: (j.packDna || "").trim(), refDnas };
}

// ==================== Generate ====================

async function asFile(src: string, name: string) {
  let buf: Buffer;
  let type = "image/png";
  if (src.startsWith("data:")) {
    type = src.slice(5, src.indexOf(";")) || type;
    buf = Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  } else {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`Could not load image (${r.status})`);
    type = r.headers.get("content-type") || type;
    buf = Buffer.from(await r.arrayBuffer());
  }
  return toFile(buf, `${name}.${type.includes("jpeg") || type.includes("jpg") ? "jpg" : type.includes("webp") ? "webp" : "png"}`, { type });
}

const apiSize = (w: number, h: number): "1024x1024" | "1024x1536" | "1536x1024" => {
  const r = w / h;
  return r > 1.15 ? "1536x1024" : r < 0.87 ? "1024x1536" : "1024x1024";
};

/** Trim to the aspect, then size exactly. */
async function finish(url: string, spec: ThumbSpec): Promise<string> {
  const ratio = spec.aspect === "1.91:1" ? "1.91:1" : spec.aspect;
  const trimmed = await trimToAspect(url, ratio).catch(() => url);
  const buf = trimmed.startsWith("data:") ? Buffer.from(trimmed.slice(trimmed.indexOf(",") + 1), "base64") : Buffer.from(await (await fetch(trimmed)).arrayBuffer());
  const out = await sharp(buf).resize(spec.w, spec.h, { fit: "cover" }).png().toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}

export async function generateThumbnail(opts: {
  pack?: Pick<DesignTemplate, "refImages" | "refDnas" | "packDna"> | null;
  packId?: string;
  brief: string;
  spec: ThumbSpec;
  text: ThumbText;
  subjects: { url: string; kind: "person" | "product" }[]; // attached photo / character photos (max 3)
  characterNote?: string; // e.g. "Mara: late 20s, short curly hair…"
  colours?: string | null;
  brandNote?: string;
  matchHint?: string;
}): Promise<{ url: string; refIndex: number | null }> {
  const pack = opts.pack && opts.pack.refImages.length ? opts.pack : null;
  let refIndex: number | null = null;
  const files: Awaited<ReturnType<typeof asFile>>[] = [];
  if (pack) {
    refIndex = await pickReference(pack, `Thumbnail for: ${opts.brief}`, opts.matchHint || "");
    if (opts.packId && pack.refImages.length > 1) refIndex = adjustPick(refIndex, pack.refImages.length, await packRefScores(opts.packId));
    files.push(await asFile(pack.refImages[refIndex], "reference"));
  }
  const subjects = opts.subjects.slice(0, 3);
  for (let i = 0; i < subjects.length; i++) files.push(await asFile(subjects[i].url, `subject${i + 1}`));

  const first = pack ? 2 : 1;
  const last = files.length;
  const wide = opts.spec.w / opts.spec.h > 1.5;
  const textRule =
    opts.text.mode === "none"
      ? "TEXT: put NO text in the image. No words, letters, numbers, captions, logos or watermarks anywhere. It is a pure picture; any text is added later."
      : opts.text.mode === "exact"
        ? `TEXT: the only text is exactly "${opts.text.text}", set in huge, bold, highly readable type with strong contrast, placed where it does not cover the subject's face. Spell it exactly. No other text.`
        : "TEXT: add ONE short, bold title of 2-4 words about the topic, huge and highly readable, not covering the subject's face. No other text.";

  const prompt = [
    `Create one finished, scroll-stopping THUMBNAIL image, ${opts.spec.aspect} (${opts.spec.w}x${opts.spec.h}).`,
    pack
      ? "IMAGE 1 is a REFERENCE thumbnail. Recreate its composition, subject framing and scale, depth, lighting, colour contrast and finish for the new topic below. Never copy its people, brand, words or props."
      : "Design it from scratch to professional YouTube-thumbnail standards.",
    subjects.length
      ? `IMAGE${first === last ? ` ${first}` : `S ${first}-${last}`} ${first === last ? "is" : "are"} the real subject${subjects.length > 1 ? "s" : ""} (${subjects.map((s) => s.kind).join(", ")}). Keep ${subjects.some((s) => s.kind === "person") ? "the person's face, hair and likeness exactly" : "the product's exact shape, colours and label"}; place ${subjects.length > 1 ? "them" : "it"} where the ${pack ? "reference's" : "main"} subject sits, with the expression and pose the topic calls for.${opts.characterNote ? ` Character: ${opts.characterNote}.` : ""}`
      : "Create a fitting main subject (a person with a strong expression, a product, or a striking scene) for the topic. Make it look like a real photograph.",
    "",
    pack?.packDna ? `THE PACK'S LOOK (follow it):\n${pack.packDna}\n` : "",
    pack && refIndex !== null && pack.refDnas[refIndex] ? `THIS REFERENCE'S DNA:\n${pack.refDnas[refIndex]}\n` : "",
    `TOPIC: ${opts.brief}`,
    textRule,
    opts.colours ? `Colour: lightly echo the brand's colours where natural: ${opts.colours}.` : "",
    opts.brandNote || "",
    "",
    "CRAFT: one clear focal point that reads at tiny size; strong contrast and separation from the background; large simple shapes; an expressive, emotional subject; clean and uncluttered; sharp, high-quality photography." +
      (wide ? " Keep the bottom-right corner clear and keep the key subject inside the middle 90% so nothing important is cropped." : "") +
      " Output only the finished thumbnail.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const client = getClient();
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const size = apiSize(opts.spec.w, opts.spec.h);
  const res = files.length
    ? await withRetry(() => client.images.edit({ model, image: files, prompt, n: 1, size, quality: getImageQuality() }))
    : await withRetry(() => client.images.generate({ model, prompt, n: 1, size, quality: getImageQuality() }));
  const d = res.data?.[0] as Record<string, unknown> | undefined;
  const raw = d?.url ? String(d.url) : d?.b64_json ? `data:image/png;base64,${d.b64_json}` : "";
  if (!raw) throw new Error("No image returned");
  return { url: await finish(raw, opts.spec), refIndex };
}

/** Is the attached photo mainly a person (face) or a product/object? One cheap vision call; a person if unsure. */
export async function classifySubject(url: string): Promise<"person" | "product"> {
  try {
    const client = getClient();
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL_FAST || process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      temperature: 0,
      max_tokens: 5,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Is the main subject of this photo a PERSON (a face or a person) or a PRODUCT (an object, item, packaged good, device, food, screenshot)? Reply with exactly one word: person or product." },
            { type: "image_url", image_url: { url, detail: "low" } },
          ],
        },
      ],
    });
    return /product/i.test(res.choices[0]?.message?.content || "") ? "product" : "person";
  } catch {
    return "person";
  }
}
