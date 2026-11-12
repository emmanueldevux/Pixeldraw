// ============================================================
// UXLLY — Reference packs (single ads)
//
// A pack = 1+ reference ads uploaded by the admin. We study them into:
//   packDna — what all of them share (the look)
//   refDnas — one short DNA per ad: its layout + what kind of ad it suits
// For a request, the AI picks the best-fitting reference, then the image
// model rebuilds THAT ad's layout with the brand's colours, fonts,
// product and the new text.
// ============================================================
import { adjustPick, packRefScores } from "@/lib/learning";
import { toFile } from "openai";
import { getClient, withRetry, getImageQuality } from "@/lib/ai/providers/openai";
import { aiComplete } from "@/lib/ai/provider";
import { parseRefDna } from "@/lib/ai/adCraft";
import { trimToAspect } from "./crop";
import type { DesignTemplate } from "./types";

// ==================== Study ====================

export async function studyPack(refs: string[]): Promise<{ packDna: string; refDnas: string[] }> {
  const images = refs.slice(0, 8);
  if (!images.length) throw new Error("Add at least one reference ad first");
  const client = getClient();
  const model = process.env.OPENAI_DNA_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-4o";
  const prompt = `You are a senior art director. The ${images.length} attached image${images.length > 1 ? "s are" : " is"} a pack of reference ADS (numbered 1 to ${images.length} in order).
Write the design DNA a designer or image model needs to make NEW ads for OTHER brands with the same quality and layouts. Describe the system, never the specific brand names, products or words in the references.

Return ONLY JSON:
{
  "packDna": "What all the ads share: overall look and mood, background treatment, lighting/photography or illustration style, typography system (font categories, weights, case, hierarchy, how emphasis is shown), text density, decorative elements (badges, stickers, shapes, icons, frames), colour roles, finish quality, and DON'Ts. 200-350 words, plain text.",
  "refs": [
    { "dna": "Ad 1 only: its layout with % positions (where the product/subject, headline, subtext, badges, CTA, logo sit), what text roles it has and their max words, what makes it distinctive. 80-150 words.", "copyPattern": "How the words on this ad are written: the type of hook (question, big number, short promise, urgency line, statement), the text roles and roughly how many words each, the call to action style. Never quote the actual words. 25-50 words.", "mood": "3-6 adjectives for the brand personalities this look suits, e.g. 'bold, energetic, youthful' or 'calm, premium, minimal'", "bestFor": "the kinds of ads this layout suits, e.g. 'price promo, flash sale, discount with a big number' or 'product launch, premium hero shot' or 'testimonial, announcement, event'" }
  ]
}
One entry in "refs" per image, in the same order.`;
  const res = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 4500,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } }))],
      },
    ],
  });
  const text = res.choices[0]?.message?.content || "";
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("The AI didn't return a DNA. Try again.");
  const j = JSON.parse(text.slice(a, b + 1)) as { packDna?: string; refs?: { dna?: string; copyPattern?: string; mood?: string; bestFor?: string }[] };
  const refDnas = images.map((_, i) => {
    const r = j.refs?.[i];
    return r
      ? `${r.dna || ""}${r.copyPattern ? `\nCOPY PATTERN: ${r.copyPattern}` : ""}${r.mood ? `\nMOOD: ${r.mood}` : ""}${r.bestFor ? `\nBEST FOR: ${r.bestFor}` : ""}`.trim()
      : "";
  });
  return { packDna: (j.packDna || "").trim(), refDnas };
}

// ==================== Pick the best reference ====================

export async function pickReference(pack: Pick<DesignTemplate, "refImages" | "refDnas">, brief: string, hint = ""): Promise<number> {
  const n = pack.refImages.length;
  if (n <= 1) return 0;
  if (!pack.refDnas.some(Boolean)) return Math.floor(Math.random() * n);
  try {
    const list = pack.refImages
      .map((_, i) => {
        const r = parseRefDna(pack.refDnas[i] || "");
        const text = [r.layout.slice(0, 420), r.copyPattern && `Copy: ${r.copyPattern}`, r.mood && `Mood: ${r.mood}`, r.bestFor && `Best for: ${r.bestFor}`].filter(Boolean).join(" | ");
        return `${i + 1}. ${(text || "(no description)").replace(/\s+/g, " ").slice(0, 800)}`;
      })
      .join("\n");
    const res = await aiComplete({
      messages: [
        {
          role: "user",
          content: `An ad is requested: "${brief.slice(0, 600)}"${hint ? `\nBrand: ${hint.slice(0, 300)}` : ""}\n\nThese reference ad layouts are available:\n${list}\n\nWhich ONE layout fits this request best (think: is it a promo with a price, a product launch, an announcement, a testimonial…)? Reply with only the number.`,
        },
      ],
      temperature: 0.2,
      maxTokens: 10,
    });
    const k = parseInt((res.content.match(/\d+/) || ["1"])[0], 10) - 1;
    return k >= 0 && k < n ? k : 0;
  } catch {
    return 0;
  }
}

// ==================== Generate ====================

const API_SIZE = (size: string): "1024x1024" | "1024x1536" | "1536x1024" => {
  const [w, h] = size.split("x").map(Number);
  if (!w || !h) return "1024x1536";
  const r = w / h;
  return r > 1.15 ? "1536x1024" : r < 0.87 ? "1024x1536" : "1024x1024";
};

async function asFile(src: string, name: string) {
  let buf: Buffer;
  let type = "image/png";
  if (src.startsWith("data:")) {
    type = src.slice(5, src.indexOf(";")) || type;
    buf = Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  } else {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`Could not load reference (${r.status})`);
    type = r.headers.get("content-type") || type;
    buf = Buffer.from(await r.arrayBuffer());
  }
  return toFile(buf, `${name}.${type.includes("jpeg") || type.includes("jpg") ? "jpg" : type.includes("webp") ? "webp" : "png"}`, { type });
}

export async function generatePackAd(opts: {
  pack: Pick<DesignTemplate, "refImages" | "refDnas" | "packDna">;
  packId?: string; // enables the learning loop (layouts people keep redoing are avoided)
  brief: string; // what the ad is for (user's request, or the chat's drafted brief)
  headline?: string;
  size: string; // "1080x1350", "1080x1080", "1080x1920", "1200x627"…
  aspect?: "4:5" | "9:16" | "1:1" | "16:9"; // trim target (templates)
  colours?: string | null; // brandColoursText(...)
  font?: string | null; // brand heading font
  brandNote?: string; // brainImageNote(...) + adCraftNote(...)
  matchHint?: string; // short brand/mood line that helps pick the layout
  productImage?: string | null;
}): Promise<{ url: string; refIndex: number }> {
  let refIndex = await pickReference(opts.pack, opts.brief, opts.matchHint || "");
  if (opts.packId && opts.pack.refImages.length > 1) {
    refIndex = adjustPick(refIndex, opts.pack.refImages.length, await packRefScores(opts.packId));
  }
  const files = [await asFile(opts.pack.refImages[refIndex], "reference")];
  if (opts.productImage) files.push(await asFile(opts.productImage, "product"));

  const trim45 = opts.aspect === "4:5";
  const prompt = [
    "Create one finished, professional social media ad.",
    "IMAGE 1 is the REFERENCE AD. Rebuild its exact layout: the same composition, positions, type hierarchy, badges, shapes, decorative elements, lighting and finish. Replace everything brand-specific with the new brand below. Never copy its brand name, logo, product, prices or words.",
    opts.productImage
      ? "IMAGE 2 is the brand's real product. Put it where the reference's product/subject sits, reproduced exactly (same shape, colours, label, every printed word spelled correctly)."
      : "Choose a product, subject or scene that fits the brief, placed where the reference's product/subject sits.",
    "",
    "THE PACK'S DESIGN DNA (shared style, follow it):",
    opts.pack.packDna || "(follow the reference closely)",
    "",
    "THIS LAYOUT'S DNA:",
    opts.pack.refDnas[refIndex] || "(follow the reference closely)",
    "",
    "WHAT THIS AD IS FOR:",
    opts.brief,
    opts.headline ? `Headline: exactly "${opts.headline}".` : "Write a short, punchy headline (2-6 words) and only the supporting text the layout needs, in the brand's voice.",
    "",
    "BRAND:",
    `Colours: ${opts.colours || "keep the reference's colour scheme"}.`,
    opts.font ? `Typography: set headlines in ${opts.font} (or its closest match); keep the reference's weights, case and hierarchy.` : "",
    opts.brandNote || "",
    "",
    "RULES: Keep the reference's text density; never crowd the ad. Every word spelled correctly. Only use prices, discounts, codes and claims that appear in the brief or brand context; never invent them. No watermarks, no extra logos." +
      (trim45 ? " The image will be trimmed to 4:5: keep the top 9% and bottom 9% as plain background with no text." : "") +
      " Output only the finished ad.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const client = getClient();
  const res = await withRetry(() =>
    client.images.edit({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", image: files, prompt, n: 1, size: API_SIZE(opts.size), quality: getImageQuality() }),
  );
  const d = res.data?.[0] as Record<string, unknown> | undefined;
  let url = d?.url ? String(d.url) : d?.b64_json ? `data:image/png;base64,${d.b64_json}` : "";
  if (!url) throw new Error("No image returned");
  if (trim45) url = await trimToAspect(url, "4:5").catch(() => url);
  return { url, refIndex };
}

// ==================== Pick the best pack ====================

/** With several packs available and none chosen, ask the AI which pack suits this request. Falls back to the first. */
export async function pickPack(packs: DesignTemplate[], brief: string, hint = ""): Promise<DesignTemplate> {
  if (packs.length <= 1) return packs[0];
  try {
    const list = packs
      .map((p, i) => {
        const best = p.refDnas.map((d) => parseRefDna(d).bestFor).filter(Boolean).slice(0, 4).join(" / ");
        const mood = p.refDnas.map((d) => parseRefDna(d).mood).filter(Boolean).slice(0, 2).join(" / ");
        return `${i + 1}. ${p.title}${p.description ? ` — ${p.description.slice(0, 160)}` : ""}${p.packDna ? ` | Look: ${p.packDna.replace(/\s+/g, " ").slice(0, 260)}` : ""}${mood ? ` | Mood: ${mood}` : ""}${best ? ` | Best for: ${best}` : ""}`;
      })
      .join("\n");
    const res = await aiComplete({
      messages: [
        {
          role: "user",
          content: `An ad is requested: "${brief.slice(0, 500)}"${hint ? `\nBrand: ${hint.slice(0, 300)}` : ""}\n\nThese ad packs are available:\n${list}\n\nWhich ONE pack suits this request and brand best (goal, industry, mood)? Reply with only the number.`,
        },
      ],
      temperature: 0.2,
      maxTokens: 10,
    });
    const k = parseInt((res.content.match(/\d+/) || ["1"])[0], 10) - 1;
    return packs[k >= 0 && k < packs.length ? k : 0];
  } catch {
    return packs[0];
  }
}
