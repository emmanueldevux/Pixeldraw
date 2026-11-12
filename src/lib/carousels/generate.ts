// ============================================================
// UXLLY — Generate a styled carousel (Intro / Details / Outro)
//
// Every slide is made by the image model from:
//   - one reference slide of its slot (layout & style only, never its words)
//   - the slot's DNA (the written design system)
//   - the brand colours (they replace the style's palette)
//   - the exact text the planner wrote for that slide
//   - optionally the user's own image for that slide
// Consistency across details pages: all use the SAME details reference,
// and once the first details page exists it's passed to the others as an
// anchor ("match this page exactly").
// Speed: round 1 = intro + first details + outro in parallel; round 2 =
// the remaining details in parallel.
// ============================================================
import { toFile } from "openai";
import { getClient, withRetry, getImageQuality } from "@/lib/ai/providers/openai";
import { compositeLogo, pickLogoPlacement, type LogoPosition } from "@/lib/ai/logoComposite";
import { trimToAspect } from "@/lib/designTemplates/crop";
import type { CarouselSize, CarouselStyle, SlideImage, SlotKey } from "./types";
import type { PlannedSlide, StyledPlan } from "./planner";

export interface GeneratedStyledSlide {
  slideNumber: number;
  role: string;
  headline: string;
  body: string;
  imageUrl: string;
}

export interface BrandColours {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  background?: string | null;
}

const API_SIZE: Record<CarouselSize, "1024x1536" | "1024x1024"> = { "4:5": "1024x1536", "1:1": "1024x1024", "9:16": "1024x1536" };
const ROLE_NAME: Record<SlotKey, string> = {
  intro: "INTRO (the scroll-stopping first slide)",
  details: "DETAILS (a middle content slide)",
  outro: "OUTRO (the closing call-to-action slide)",
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
  const ext = type.includes("jpeg") || type.includes("jpg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  return toFile(buf, `${name}.${ext}`, { type });
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function coloursText(c: BrandColours): string {
  if (!c.primary && !c.accent) return "Keep the reference style's own palette.";
  const parts = [
    c.primary && `primary ${c.primary} (takes the reference's dark/main colour role: titles, key shapes, panels)`,
    c.accent && `accent ${c.accent} (highlights, emphasised words, icons, arrows, buttons)`,
    c.secondary && `secondary ${c.secondary} (supporting text and small details)`,
    c.background && `background ${c.background}`,
  ].filter(Boolean);
  return `Recolour the whole design with the brand colours instead of the reference's palette, mapping them onto the colour roles in the DNA: ${parts.join(", ")}.${
    c.background ? "" : " Use a clean light or dark background that suits these colours."
  } Keep strong contrast so every word reads easily. Skin tones, photos and natural objects keep natural colours.`;
}

function slidePrompt(p: {
  slide: PlannedSlide;
  total: number;
  dna: string;
  colours: BrandColours;
  size: CarouselSize;
  hasUserImage: boolean;
  hasAnchor: boolean;
}): string {
  const { slide } = p;
  const slot = slide.role as SlotKey;
  let img = 1;
  const lines: string[] = [];
  lines.push(`Design slide ${slide.slideNumber} of ${p.total} of a social media carousel: the ${ROLE_NAME[slot]}.`);
  lines.push(
    `IMAGE ${img++} is a LAYOUT AND STYLE REFERENCE for this slide type. Rebuild its layout, typography, spacing, visual treatment and recurring elements faithfully, but with the NEW content below. Do NOT copy any of its words, names, people, faces or logos.`,
  );
  if (p.hasUserImage)
    lines.push(`IMAGE ${img++} is the user's own image. Use it as this slide's main visual: keep the person/product recognisable, styled and framed to fit this design.`);
  if (p.hasAnchor)
    lines.push(
      `IMAGE ${img++} is a finished details slide from THIS SAME carousel. Match its layout, margins, type sizes, colours and visual treatment EXACTLY, so the two read as consecutive pages; only the text and the visual's subject change.`,
    );
  lines.push("", "SLIDE TYPE DNA (follow precisely):", p.dna || "(no DNA written yet: follow the reference closely)");
  lines.push("", "COLOURS:", coloursText(p.colours));
  lines.push("", "TEXT ON THIS SLIDE (render exactly these words, spelled exactly, and no other text):");
  if (slide.title) lines.push(`- Title: "${slide.title}"`);
  if (slide.body) lines.push(`- Body: "${slide.body}" (show **text** as bold and *text* as italic; never show the asterisks)`);
  for (const l of slide.labels) lines.push(`- Small label: "${l}"`);
  lines.push("", `VISUAL: ${p.hasUserImage ? "built from the user's image (see above)" : slide.visual || "a fitting visual in the reference's medium"}.`);
  lines.push(
    "",
    "RULES: Follow the DNA's text sizes, weights and density; never crowd the slide. Keep all text at least 6% away from every edge." +
      (p.size === "4:5" ? " The image will be trimmed to 4:5: keep the top 9% and bottom 9% of the canvas as plain background with no text or key elements." : "") +
      " Every word spelled correctly. No watermarks, no extra logos, no page numbers unless the DNA has them. Output only the finished slide.",
  );
  return lines.join("\n");
}

export type RefChoice = Record<SlotKey, string>;

/** Random intro + outro reference (variety), ONE details reference for the whole carousel. */
export function chooseRefs(style: CarouselStyle): RefChoice {
  return { intro: pick(style.introRefs), details: pick(style.detailsRefs), outro: pick(style.outroRefs) };
}

export interface RenderContext {
  style: CarouselStyle;
  refs: RefChoice;
  size: CarouselSize;
  colours: BrandColours;
  total: number;
  userImages?: SlideImage[];
  logoUrl?: string | null;
  logoPlacement?: { position: LogoPosition; scale: number } | null;
}

export function logoPlacementFor(logoUrl?: string | null, logoPosition?: LogoPosition, logoScale?: number) {
  if (!logoUrl) return null;
  return logoPosition ? { position: logoPosition, scale: logoScale ?? 0.12 } : pickLogoPlacement();
}

/** Render one slide. Never throws: a failed slide comes back with imageUrl "". */
export async function renderStyledSlide(ctx: RenderContext, slide: PlannedSlide, anchor?: string): Promise<GeneratedStyledSlide> {
  const slot = slide.role as SlotKey;
  const dna = { intro: ctx.style.introDna, details: ctx.style.detailsDna, outro: ctx.style.outroDna }[slot];
  const userImg = ctx.userImages?.find(
    (u) => u.target === slide.slideNumber || u.target === slide.role || (u.target === "details" && slide.role === "details"),
  )?.dataUrl;
  try {
    const client = getClient();
    const files = [await asFile(ctx.refs[slot], `ref-${slot}`)];
    if (userImg) files.push(await asFile(userImg, "user"));
    if (anchor) files.push(await asFile(anchor, "anchor"));
    const prompt = slidePrompt({ slide, total: ctx.total, dna, colours: ctx.colours, size: ctx.size, hasUserImage: !!userImg, hasAnchor: !!anchor });
    const res = await withRetry(() =>
      client.images.edit({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", image: files, prompt, n: 1, size: API_SIZE[ctx.size], quality: getImageQuality() }),
    );
    const d = res.data?.[0] as Record<string, unknown> | undefined;
    let url = d?.url ? String(d.url) : d?.b64_json ? `data:image/png;base64,${d.b64_json}` : "";
    if (url && ctx.size === "4:5") url = await trimToAspect(url, "4:5").catch(() => url);
    // Brand logo on the intro and outro only, so it never fights the details layout.
    if (url && ctx.logoPlacement && ctx.logoUrl && slot !== "details") {
      url = await compositeLogo(url, ctx.logoUrl, ctx.logoPlacement.position, ctx.logoPlacement.scale).catch(() => url);
    }
    return { slideNumber: slide.slideNumber, role: slot, headline: slide.title, body: slide.body, imageUrl: url };
  } catch (e) {
    console.error(`[CAROUSEL STYLE] slide ${slide.slideNumber} failed:`, e);
    return { slideNumber: slide.slideNumber, role: slot, headline: slide.title, body: slide.body, imageUrl: "" };
  }
}

/** Which slides each round renders: round 1 = intro + first details + outro; round 2 = the other details. */
export function roundSlides(plan: StyledPlan, round: 1 | 2): PlannedSlide[] {
  const s = plan.slides;
  return round === 1 ? [s[0], ...(s.length > 2 ? [s[1]] : []), s[s.length - 1]] : s.slice(2, -1);
}

/** All slides in one request (small carousels / fallback). */
export async function generateStyledCarousel(params: {
  plan: StyledPlan;
  style: CarouselStyle;
  size: CarouselSize;
  colours: BrandColours;
  userImages?: SlideImage[];
  logoUrl?: string | null;
  logoPosition?: LogoPosition;
  logoScale?: number;
}): Promise<GeneratedStyledSlide[]> {
  const ctx: RenderContext = {
    style: params.style,
    refs: chooseRefs(params.style),
    size: params.size,
    colours: params.colours,
    total: params.plan.slides.length,
    userImages: params.userImages,
    logoUrl: params.logoUrl,
    logoPlacement: logoPlacementFor(params.logoUrl, params.logoPosition, params.logoScale),
  };
  const r1 = await Promise.all(roundSlides(params.plan, 1).map((sl) => renderStyledSlide(ctx, sl)));
  const firstDetails = r1.find((x) => x.role === "details" && x.imageUrl)?.imageUrl;
  const r2 = await Promise.all(roundSlides(params.plan, 2).map((sl) => renderStyledSlide(ctx, sl, firstDetails)));
  const out = [...r1, ...r2].sort((a, b) => a.slideNumber - b.slideNumber);
  console.log("[CAROUSEL STYLE] done:", out.filter((x) => x.imageUrl).length, "/", out.length);
  return out;
}
