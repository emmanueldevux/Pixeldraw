// ============================================================
// UXLLY — Produce one planned post (image or carousel + caption)
//
// Used by the plan cron ~a day before a slot. Each phase bills what it
// really used (real-cost credits), and a finished design is saved to the
// user's Files. Singles get the critic pass: one automatic fix-and-retry
// if the check finds misspellings, wrong colours, crowding or a covered logo.
// ============================================================
import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai/provider";
import { openaiGenerateImage } from "@/lib/ai/providers/openai";
import { togetherGenerateImage } from "@/lib/ai/providers/together";
import { compositeLogo, pickLogoPlacement, type LogoPosition } from "@/lib/ai/logoComposite";
import { critiqueImage } from "@/lib/ai/critic";
import { trimToAspect } from "@/lib/designTemplates/crop";
import { resolvePack } from "@/lib/designTemplates/store";
import { generatePackAd } from "@/lib/designTemplates/pack";
import { adCraftNote, moodFromVoice } from "@/lib/ai/adCraft";
import { brandColoursText } from "@/lib/designTemplates/types";
import { getBrain } from "@/lib/brain/generate";
import { brainToPrompt, brainImageNote } from "@/lib/brain/prompt";
import { isEmptyBrain } from "@/lib/brain/types";
import { planStyledCarousel } from "@/lib/carousels/planner";
import { resolveStyle } from "@/lib/carousels/store";
import { chooseRefs, logoPlacementFor } from "@/lib/carousels/generate";
import { createCarouselTask, runCarouselStep } from "@/lib/carousels/task";
import { saveGeneration, persistImage } from "@/lib/generations";
import { authorize, commit, meterFollowUp } from "@/lib/billing/meter";
import { setNegativePrompt, applyProjectNegative } from "@/lib/billing/usage";
import type { ImageSize } from "@/types";

const SIZE_PX: Record<string, string> = { "4:5": "1080x1350", "1:1": "1080x1080", "9:16": "1080x1920" };

export interface ProduceResult {
  imageUrls: string[];
  caption: string;
  hashtags: string[];
  generationId: string | null;
}

type ItemRow = { id: string; userId: string; brandId: string; platform: string; format: string; size: string; topic: string; theme: string | null };

async function loadBrand(brandId: string) {
  return db.brand.findUnique({ where: { id: brandId }, include: { styleGuide: true } });
}
type LoadedBrand = NonNullable<Awaited<ReturnType<typeof loadBrand>>>;

function adv(brand: LoadedBrand): Record<string, unknown> {
  return ((brand.styleGuide as unknown as { advancedSettings?: Record<string, unknown> } | null)?.advancedSettings) || {};
}

function styleGuideFor(brand: LoadedBrand): Record<string, unknown> | null {
  const sg = brand.styleGuide as unknown as Record<string, unknown> | null;
  if (!sg) return null;
  const a = adv(brand);
  return {
    primaryColor: sg.primaryColor,
    secondaryColor: sg.secondaryColor,
    accentColor: sg.accentColor,
    backgroundColor: sg.backgroundColor || undefined,
    headingFont: sg.headingFont,
    bodyFont: a.bodyFont,
    tone: sg.tone,
    extraNotes: sg.extraNotes || undefined,
    rawMarkdown: sg.rawMarkdown || undefined,
    layoutArchetypes: sg.layoutArchetypes,
    language: (a.language as string) || undefined,
    ecommerce: a.ecommerce,
  };
}

function parseJsonObject(text: string): Record<string, unknown> {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON");
  return JSON.parse(text.slice(a, b + 1));
}

const cleanTags = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((t) => String(t).trim().replace(/^#*/, "#").replace(/\s+/g, ""))
    .filter((t) => t.length > 1 && t.length < 40)
    .slice(0, 12);

/** Caption + hashtags + design brief for a post, from the Brand Brain. */
export async function writeCopy(opts: { brand: LoadedBrand; platform: string; topic: string; kind: "single" | "carousel"; slidesSummary?: string }) {
  const brain = await getBrain(opts.brand.id).catch(() => null);
  const brainText = brain && !isEmptyBrain(brain.data) ? brainToPrompt(brain.data) : "";
  const language = (adv(opts.brand).language as string) || "";
  const prompt = [
    `You write social media posts for "${opts.brand.name}" (${opts.platform}).`,
    brainText,
    `POST BRIEF: ${opts.topic}`,
    opts.slidesSummary ? `CAROUSEL SLIDES: ${opts.slidesSummary}` : "",
    language && language !== "English" ? `Write all text in ${language}.` : "",
    "Rules: the caption opens with a hook in the first line, sounds like the brand's voice, fits the platform (LinkedIn longer and professional; Instagram/TikTok short and punchy; X under 270 characters), ends with one clear call to action. Hashtags: 5-10, specific to the niche and audience, no spaces. NEVER invent prices, discounts, codes or claims; only use offers that appear in the brand context.",
    opts.kind === "single"
      ? 'Also write "headline" (2-6 words printed on the image) and "design": a vivid 2-4 sentence art-direction brief for the image (subject, scene, mood, where the headline sits). No brand colours or fonts in it (those are applied separately).'
      : "",
    `Reply with ONLY JSON: {${opts.kind === "single" ? '"headline": "", "design": "", ' : ""}"caption": "", "hashtags": ["#..."], "firstComment": ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const res = await aiComplete({ messages: [{ role: "user", content: prompt }], temperature: 0.7, maxTokens: 900 });
  const j = parseJsonObject(res.content);
  return {
    headline: String(j.headline || "").slice(0, 80),
    design: String(j.design || opts.topic).slice(0, 900),
    caption: String(j.caption || "").slice(0, 2200),
    hashtags: cleanTags(j.hashtags),
  };
}

/** One image for a single post, using the project's own refs, its ad pack, or the brand style alone. */
async function renderSingle(brand: LoadedBrand, item: ItemRow, brief: string, headline: string, fix: string): Promise<{ url: string; pack: { id: string; refIndex: number } | null }> {
  const size = SIZE_PX[item.size] || "1080x1080";
  const a = adv(brand);
  const sg = brand.styleGuide as unknown as Record<string, string | null> | null;
  const colours = sg ? brandColoursText({ primary: sg.primaryColor, secondary: sg.secondaryColor, accent: sg.accentColor, background: sg.backgroundColor }) : null;
  const guide = brand.styleGuide as unknown as { generationPool?: unknown; referenceImages?: unknown } | null;
  const pool = Array.isArray(guide?.generationPool) && guide!.generationPool!.length ? (guide!.generationPool as string[]) : Array.isArray(guide?.referenceImages) ? (guide!.referenceImages as string[]) : [];
  const margins = item.size === "4:5" ? " Keep the top 9% and bottom 9% as plain background with no text; the image is trimmed to 4:5." : "";
  const text = `${brief}${headline ? ` Headline text, spelled exactly: "${headline}".` : ""}${margins}${fix ? `\n${fix}` : ""}`;

  let url = "";
  let packUsed: { id: string; refIndex: number } | null = null;
  if (pool.length === 0 && process.env.OPENAI_API_KEY) {
    const brain = await getBrain(brand.id).catch(() => null);
    const brainOk = !!brain && !isEmptyBrain(brain.data);
    const matchHint = brainOk ? [brain!.data.business.industry, brain!.data.voice.oneLine, moodFromVoice(brain!.data)].filter(Boolean).join("; ") : "";
    const pack = await resolvePack(a.adPackId as string | undefined, { userId: item.userId, brief: text, hint: matchHint }).catch(() => null);
    if (pack) {
      const out = await generatePackAd({
        pack,
        packId: pack.id,
        brief: text,
        headline: headline || undefined,
        size,
        aspect: item.size as "4:5" | "9:16" | "1:1",
        colours,
        font: sg?.headingFont || null,
        brandNote: [brainOk ? brainImageNote(brain!.data) : "", adCraftNote(text, brainOk ? brain!.data : null)].filter(Boolean).join("\n\n"),
        matchHint,
      });
      url = out.url;
      packUsed = { id: pack.id, refIndex: out.refIndex };
    }
  }
  if (!url) {
    if (process.env.OPENAI_API_KEY) {
      const out = await openaiGenerateImage({ prompt: text, size: size as ImageSize, referenceImages: pool, styleGuide: styleGuideFor(brand), platform: item.platform, brandName: brand.name });
      url = out.url;
      if (item.size === "4:5") url = await trimToAspect(url, "4:5").catch(() => url);
    } else if (process.env.TOGETHER_API_KEY) {
      url = (await togetherGenerateImage({ prompt: text, size: size as ImageSize })).url;
    } else {
      throw new Error("No image provider configured.");
    }
  }
  if (brand.logo) {
    const place = brand.logoPosition ? { position: brand.logoPosition as unknown as LogoPosition, scale: brand.logoScale ?? 0.12 } : pickLogoPlacement();
    url = await compositeLogo(url, brand.logo, place.position, place.scale).catch(() => url);
  }
  return { url, pack: packUsed };
}

async function produceSingle(item: ItemRow, brand: LoadedBrand): Promise<ProduceResult> {
  const mark = meterFollowUp(item.userId);
  const copy = await writeCopy({ brand, platform: item.platform, topic: item.topic, kind: "single" });
  const first = await renderSingle(brand, item, copy.design, copy.headline, "");
  let url = first.url;
  let packUsed = first.pack;

  // Critic pass: one automatic fix-and-retry.
  const sg = brand.styleGuide as unknown as Record<string, string | null> | null;
  const verdict = await critiqueImage({
    imageUrl: url,
    expectedText: copy.headline ? [copy.headline] : [],
    colours: sg ? brandColoursText({ primary: sg.primaryColor, secondary: sg.secondaryColor, accent: sg.accentColor, background: sg.backgroundColor }) : null,
    hasLogo: !!brand.logo,
    aspect: item.size,
  });
  let retried = false;
  if (!verdict.ok) {
    try {
      const again = await renderSingle(brand, item, copy.design, copy.headline, verdict.fix);
      url = again.url;
      packUsed = again.pack;
      retried = true;
    } catch (e) {
      console.warn("[PRODUCE] critic retry failed, keeping the first image:", (e as Error).message);
    }
  }

  const stored = await persistImage(url, "generated");
  const gen = await saveGeneration({
    userId: item.userId,
    brandId: brand.id,
    kind: "image",
    title: copy.headline || item.topic.slice(0, 80),
    imageUrls: [stored],
    caption: [copy.caption, copy.hashtags.join(" ")].filter(Boolean).join("\n\n"),
    prompt: copy.design,
    meta: { planItemId: item.id, source: "plan", critic: { ok: verdict.ok, issues: verdict.issues, retried }, ...(packUsed ? { pack: packUsed } : {}) },
  });
  await commit(item.userId, mark, [{ key: "chat.text" }, { key: "image.openai", qty: retried ? 2 : 1 }], { ref: `plan:${item.id}`, note: `Planned post (${item.platform})` }).catch((e) => console.error("[PRODUCE] billing failed:", e));
  return { imageUrls: [stored], caption: copy.caption, hashtags: copy.hashtags, generationId: gen.id };
}

async function produceCarousel(item: ItemRow, brand: LoadedBrand): Promise<ProduceResult> {
  const style = await resolveStyle(((adv(brand).carousel as { styleId?: string } | undefined)?.styleId) || null, item.userId);
  if (!style) return produceSingle({ ...item, format: "single" }, brand); // no carousel style published: fall back to a single post
  const carousel = (adv(brand).carousel as { authorName?: string; handle?: string } | undefined) || {};
  const sg = brand.styleGuide as unknown as Record<string, string | null> | null;
  const brain = await getBrain(brand.id).catch(() => null);

  const mark = meterFollowUp(item.userId);
  const plan = await planStyledCarousel({
    topic: item.topic,
    detailCount: 5,
    style,
    brandName: brand.name,
    brandBrain: brain && !isEmptyBrain(brain.data) ? brainToPrompt(brain.data) : undefined,
    authorName: carousel.authorName || brand.name,
    handle: carousel.handle,
    language: (adv(brand).language as string) || undefined,
  });
  const copy = await writeCopy({ brand, platform: item.platform, topic: item.topic, kind: "carousel", slidesSummary: plan.slides.map((s) => `${s.slideNumber}. ${s.title}`).join(" | ") });
  await commit(item.userId, mark, [{ key: "carousel.plan" }, { key: "chat.text" }], { ref: `plan:${item.id}:copy`, note: "Planned carousel: copy" }).catch(() => {});

  const task = await createCarouselTask(item.userId, {
    brandId: brand.id,
    styleId: style.id,
    styleName: style.name,
    plan,
    refs: chooseRefs(style),
    size: (item.size as "4:5" | "1:1" | "9:16") || "4:5",
    colours: { primary: sg?.primaryColor, secondary: sg?.secondaryColor, accent: sg?.accentColor, background: sg?.backgroundColor },
    userImages: [],
    logoUrl: brand.logo || null,
    logoPlacement: logoPlacementFor(brand.logo, (brand.logoPosition as unknown as LogoPosition | null) || undefined, brand.logoScale ?? undefined),
    topic: item.topic,
  });
  let view = task;
  for (let i = 0; i < 3 && view.status === "running"; i++) {
    const next = await runCarouselStep(task.id, item.userId);
    if (!next) break;
    view = next;
  }
  if (view.status !== "done") throw new Error(view.error || "Carousel did not finish");
  const imageUrls = view.slides.map((s) => s.imageUrl).filter(Boolean);
  if (view.generationId) {
    await db.generation.update({ where: { id: view.generationId }, data: { caption: [copy.caption, copy.hashtags.join(" ")].filter(Boolean).join("\n\n") } }).catch(() => {});
  }
  return { imageUrls, caption: copy.caption, hashtags: copy.hashtags, generationId: view.generationId ?? null };
}

/** Make the post. Throws on failure (the caller marks the item failed). */
export async function produceItem(itemId: string): Promise<ProduceResult> {
  const item = (await db.planItem.findUnique({ where: { id: itemId } })) as ItemRow | null;
  if (!item) throw new Error("Plan item not found");
  const brand = await loadBrand(item.brandId);
  if (!brand) throw new Error("Project not found");
  setNegativePrompt(undefined);
  applyProjectNegative(adv(brand));
  // Balance check first: nothing runs if they can't afford a post.
  await authorize(item.userId, [{ key: "chat.text" }, { key: item.format === "carousel" ? "image.edit" : "image.openai", qty: item.format === "carousel" ? 7 : 2 }], { trial: "none" });
  return item.format === "carousel" ? produceCarousel(item, brand) : produceSingle(item, brand);
}
