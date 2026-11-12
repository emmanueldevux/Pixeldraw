// ============================================================
// UXLLY — OpenAI Provider
// Structured prompt pipeline:
// 1. GPT-4o sees reference → extracts visual DNA as JSON
// 2. System adds brand content (text, colors, positions)
// 3. Combined prompt + reference → gpt-image-1 generates
// ============================================================

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import crypto from "crypto";
import type {
  AICompletionRequest,
  AICompletionResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  StyleGuideData,
} from "@/types";
import { pickInspiration } from "@/lib/ai/inspiration";
import { pickCreativeDirection, pickVisualSubject } from "@/lib/ai/creativeDirector";
import { compositeLogo, pickLogoPlacementForComposition, type LogoPosition } from "@/lib/ai/logoComposite";
import { getFontStyleDescriptor } from "@/lib/fonts";
import type { LayoutArchetype } from "@/types";
import { recordOpenAIImage, recordOpenAIText, currentNegative } from "@/lib/billing/usage";
import { imageOutTokens } from "@/lib/billing/metered";

export function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return instrument(new OpenAI({ apiKey }));
}

// Every chat/vision/image call made through getClient() reports its real
// token usage to the billing recorder (lib/billing/usage.ts), so the user is
// charged what the call actually cost × markup.
function instrument(client: OpenAI): OpenAI {
  const chat = client.chat.completions;
  const origChat = chat.create.bind(chat) as (...a: unknown[]) => Promise<unknown>;
  (chat as unknown as { create: unknown }).create = async (...args: unknown[]) => {
    const res = await origChat(...args);
    const body = args[0] as { model?: string; stream?: boolean };
    if (!body?.stream) recordOpenAIText(body?.model || "openai", (res as { usage?: never }).usage);
    return res;
  };
  for (const method of ["generate", "edit"] as const) {
    const orig = (client.images[method] as (...a: unknown[]) => Promise<unknown>).bind(client.images);
    (client.images as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
      // The project's negative prompt rides along on every image this request makes.
      const neg = currentNegative();
      const req = args[0] as { prompt?: string } | undefined;
      if (neg && req && typeof req.prompt === "string" && !req.prompt.includes("NEVER INCLUDE (brand rules)")) {
        args[0] = { ...req, prompt: `${req.prompt}\n\nNEVER INCLUDE (brand rules): ${neg}` };
      }
      const res = await orig(...args);
      const body = args[0] as { model?: string; size?: string; quality?: string; image?: unknown };
      const n = Array.isArray(body?.image) ? body.image.length : body?.image ? 1 : 0;
      recordOpenAIImage(body?.model || "gpt-image", (res as { usage?: never }).usage, {
        textIn: 1200,
        imageIn: n * 1500,
        out: imageOutTokens(body?.size || "1024x1536", body?.quality || "medium"),
      });
      return res;
    };
  }
  return client;
}

// ==================== Cost Controls (env-driven) ====================
export type ImageQuality = "low" | "medium" | "high" | "auto";

// Image render quality for FINAL generations (chat + carousel). gpt-image-2
// cost scales steeply with this tier, so "medium" is the default and a large
// saving over "high" with little visible difference for social graphics.
// Override per environment with OPENAI_IMAGE_QUALITY=low|medium|high|auto.
export function getImageQuality(): ImageQuality {
  const q = (process.env.OPENAI_IMAGE_QUALITY || "medium").toLowerCase();
  return (["low", "medium", "high", "auto"].includes(q) ? q : "medium") as ImageQuality;
}

// Vision model used to read a reference's "visual DNA". Defaults to the much
// cheaper gpt-4o-mini; set OPENAI_VISION_MODEL=gpt-4o to restore full quality.
export function getVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
}

// Instruction appended when the user attaches a product image, so the model
// treats it as the hero element and reproduces it faithfully rather than
// reinterpreting it. The product image is passed to images.edit alongside the
// style reference (it is NOT desaturated — its real colors must survive).
const PRODUCT_RULE =
  " A product image has been provided as an additional reference. Incorporate THIS EXACT product into the composition as the hero element — reproduce it faithfully (same shape, colors, label text, and proportions). Do NOT redraw, restyle, recolor, crop out, or replace it. Place it naturally in the scene with correct perspective, lighting, and a believable shadow, sized so it clearly reads as the focal point.";

// Load a product image (data URL or http URL) into an OpenAI file WITHOUT
// stripping its color — unlike the style reference, the product must keep its
// real appearance.
async function productToFile(productImage: string) {
  let buf: Buffer;
  if (productImage.startsWith("http")) {
    const r = await fetch(productImage);
    buf = Buffer.from(await r.arrayBuffer());
  } else {
    let u = productImage;
    if (u.startsWith("data:") && !u.match(/^data:image\/(png|jpeg|gif|webp)/)) {
      u = u.replace(/^data:[^;]+;/, "data:image/png;");
    }
    buf = Buffer.from(u.replace(/^data:image\/\w+;base64,/, ""), "base64");
  }
  return toFile(buf, "product.png", { type: "image/png" });
}

// In-memory cache of extracted visual DNA, keyed by the reference set. A
// brand's reference DNA barely changes between generations, so re-running a
// vision call every time is wasted spend. Cache lives per warm instance
// (cleared on cold start); disable with OPENAI_DNA_CACHE=off.
const _dnaCache = new Map<string, Record<string, unknown>>();
const _DNA_CACHE_MAX = 200;
function _dnaCacheEnabled(): boolean {
  return (process.env.OPENAI_DNA_CACHE || "on").toLowerCase() !== "off";
}
function _dnaKey(referenceImages: string[]): string {
  const h = crypto.createHash("sha1");
  for (const r of referenceImages) h.update(`${r.length}:${r.slice(0, 160)}|`);
  return h.digest("hex");
}

// ==================== Retry Helper ====================
// Your connection drops mid-request sometimes (ECONNRESET / network resets),
// especially on the larger reference-image payloads sent to images.edit.
// One retry with a short delay recovers most of these transient drops
// without falling all the way back to the no-reference generation path.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 1500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const errText = err instanceof Error ? `${err.message} ${String((err as { cause?: unknown }).cause ?? "")}` : String(err);
      const isNetworkError = /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|Connection error/i.test(errText);
      if (!isNetworkError || i === attempts - 1) throw err;
      console.log(`[OPENAI] Network error, retrying (${i + 1}/${attempts - 1})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

// ==================== Text Completion ====================

export async function openaiComplete(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const client = getClient();
  const model = request.model || process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

  const response = await client.chat.completions.create({
    model,
    messages: request.messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens ?? 2048,
  });

  const choice = response.choices[0];
  return {
    content: choice?.message?.content || "",
    model: response.model,
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
  };
}

// ==================== Image Generation ====================

export async function openaiGenerateImage(
  request: ImageGenerationRequest & {
    referenceImages?: string[];
    styleGuide?: Partial<StyleGuideData> | null;
    platform?: string;
    brandName?: string | null;
    logoUrl?: string | null;
    logoPosition?: LogoPosition;
    logoScale?: number;
    productImage?: string | null;
  }
): Promise<ImageGenerationResponse> {
  const client = getClient();
  const refs = request.referenceImages || [];
  const style = request.styleGuide;
  const platform = request.platform;
  const brandName = request.brandName;
  const quality: ImageQuality = (request.quality as ImageQuality) || getImageQuality();
  const productImage = request.productImage || null;

  console.log("[OPENAI] === STRUCTURED PROMPT PIPELINE ===");
  console.log("[OPENAI] References:", refs.length, "| Style guide:", style ? "YES" : "NO");
  if (style) {
    console.log("[OPENAI] 🎨 Incoming style guide — primary:", style.primaryColor, "| accent:", style.accentColor, "| secondary:", style.secondaryColor, "| background:", style.backgroundColor ?? "(unset)");
  } else {
    console.log("[OPENAI] ⚠️ No style guide object received at all — colors will fall back to hardcoded defaults");
  }

  // Parse size for the platform
  const sizeMap: Record<string, "1024x1024" | "1024x1536" | "1536x1024"> = {
    "1080x1080": "1024x1024",
    "1080x1350": "1024x1536", // 4:5: rendered 2:3, trimmed to 4:5 by the caller
    "1080x1920": "1024x1536",
    "1920x1080": "1536x1024",
    "1200x627": "1536x1024",
    "1200x630": "1536x1024",
    "1600x900": "1536x1024",
    "1280x720": "1536x1024",
    "1000x1500": "1024x1536",
  };
  const imageSize = sizeMap[request.size] || "1024x1024";

  let result: ImageGenerationResponse;

  if (refs.length > 0) {
    try {
      result = await structuredPipeline(client, request.prompt, refs, style, imageSize, platform, brandName, quality, productImage);
    } catch (err) {
      console.error("[OPENAI] Pipeline failed:", err);
      result = await standardGenerate(client, request.prompt, style, imageSize, quality, productImage);
    }
  } else {
    result = await standardGenerate(client, request.prompt, style, imageSize, quality, productImage);
  }

  // ========== Logo Compositing (always last, always separate) ==========
  // The logo NEVER goes through images.edit or any vision call — it is
  // pasted pixel-exact onto the finished generation here, after the
  // generative model is done. This guarantees it's never redrawn,
  // recolored, or distorted, just resized proportionally and positioned.
  if (request.logoUrl && result.url) {
    try {
      // No explicit position locked in → react to where THIS generation's
      // main content actually sits (e.g. centered content pairs with a
      // top-middle logo), falling back to weighted random variety when
      // the composition doesn't indicate anything centered. An explicit
      // position (set in Settings) is respected exactly, every time.
      const placement =
        request.logoPosition
          ? { position: request.logoPosition, scale: request.logoScale ?? 0.14 }
          : pickLogoPlacementForComposition(result.compositionText);

      console.log("[OPENAI] Compositing logo at", placement.position, `(${Math.round(placement.scale * 100)}%)`, request.logoPosition ? "[locked]" : "[auto]");
      const composited = await compositeLogo(result.url, request.logoUrl, placement.position, placement.scale);
      result = { ...result, url: composited };
    } catch (err) {
      console.error("[OPENAI] Logo compositing failed, returning image without logo:", err);
    }
  }

  return result;
}

// ==================== STRUCTURED PIPELINE ====================

// ==================== Extract Visual DNA (Step 1, reusable) ====================
// Factored out so the carousel pipeline can call this once and reuse the
// result across all slides, instead of every consumer needing its own copy.

export async function extractVisualDNA(
  client: OpenAI,
  referenceImages: string[]
): Promise<Record<string, unknown>> {
  const _cacheKey = _dnaCacheEnabled() ? _dnaKey(referenceImages) : null;
  if (_cacheKey && _dnaCache.has(_cacheKey)) {
    console.log("[OPENAI] Visual DNA: cache hit — skipping vision call");
    return _dnaCache.get(_cacheKey)!;
  }

  const visionContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

  // Sample randomly from the reference pool for analysis — with a grid
  // reference now exploded into individual panels (see analyze route),
  // always taking the first two would mean the same two panels every
  // time. Shuffle and take 2 so different generations see different
  // panels, contributing to real output variety.
  const analysisRefs = [...referenceImages].sort(() => Math.random() - 0.5).slice(0, 2);
  for (const ref of analysisRefs) {
    let url = ref;
    if (url.startsWith("data:") && !url.match(/^data:image\/(png|jpeg|gif|webp)/)) {
      url = url.replace(/^data:[^;]+;/, "data:image/jpeg;");
    }
    visionContent.push({
      type: "image_url",
      image_url: { url, detail: "high" },
    });
  }

  visionContent.push({
    type: "text",
    text: `Analyze this reference image in extreme detail, focusing ONLY on structure, layout, and technique — NOT color. Output a JSON object describing the visual DNA. Return ONLY valid JSON, no markdown, no backticks.

CRITICAL: The brand's own colors will be applied separately and MUST override anything in this reference. Do NOT mention specific colors, hex codes, or color names in any field below except "color_palette". Describe backgrounds, lighting, materials, and effects purely in terms of shape, direction, placement, texture, and intensity — as if the image were grayscale.

{
  "background": "structure only: gradient direction/shape, texture, depth, layering — no color words",
  "lighting": "structure only: direction, rim light placement, glow shape/intensity, light trail paths — no color words",
  "typography_style": "Look carefully, do not default to guessing bold: headline weight (Light/Regular/Medium/Semibold/Bold/Black — check the actual stroke thickness), subheading/body weight (this is very often LIGHTER than the headline — Regular or Medium is common even when the headline is Bold, don't assume everything matches the headline's weight), EXACT case — state explicitly whether headline text is ALL UPPERCASE, Title Case, Sentence case, or lowercase (look carefully, don't assume uppercase), relative size of headline vs subheading vs body (e.g. headline ~4x body size), shadow/glow shape — no color words",
  "composition": "Describe PRECISELY, looking carefully at the actual reference — do not default to vague phrases: (1) TEXT ALIGNMENT — state exactly where the main headline sits: horizontal (left-aligned / center-aligned / right-aligned) AND vertical (top / middle / bottom) zone of the frame. (2) MAIN VISUAL/GRAPHIC placement — where does the dominant image, illustration, or object sit relative to the text (same side, opposite side, behind, below)? (3) FLOW — what's the reading order (text-first-then-image, image-first-then-text, overlapping)? (4) Any secondary elements (badges, buttons, small graphics) and where they anchor. Be specific and literal about positions — 'top-middle aligned' or 'left-aligned, vertically centered' are the kind of precise answers needed, not 'balanced' or 'clear hierarchy'.",
  "motion_effects": "any blur, streaks, particles, trails — direction and shape only, no color words",
  "mood": "overall atmosphere in 3-5 words, no color words",
  "material_quality": "surface quality of objects (metallic, matte, glossy, translucent) — finish only, no color words",
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "distinctive_elements": "unique structural/technique signatures that make this style recognizable — no color words"
}`,
  });

  const visionResponse = await client.chat.completions.create({
    model: getVisionModel(),
    messages: [{ role: "user", content: visionContent }],
    max_tokens: 500,
    temperature: 0.1,
  });

  let basePromptJSON: Record<string, unknown> = {};
  const rawJSON = visionResponse.choices[0]?.message?.content?.trim() || "{}";

  try {
    const cleaned = rawJSON.replace(/```json\n?|```\n?/g, "").trim();
    basePromptJSON = JSON.parse(cleaned);
    console.log("[OPENAI] Visual DNA extracted:", Object.keys(basePromptJSON).join(", "));
  } catch {
    console.log("[OPENAI] Visual DNA: JSON parse failed, using raw text");
    basePromptJSON = { raw_description: rawJSON };
  }

  if (_cacheKey) {
    if (_dnaCache.size >= _DNA_CACHE_MAX) _dnaCache.clear();
    _dnaCache.set(_cacheKey, basePromptJSON);
  }

  return basePromptJSON;
}

// ==================== Prepare Desaturated Reference (reusable) ====================
// Picks one reference at random and strips its color, same as Step 4 of
// the single-image pipeline — factored out so the carousel pipeline can
// call this ONCE and reuse the same edit-base image across every slide,
// instead of a different random reference winning per slide (which would
// break visual cohesion across the set).

export async function prepareDesaturatedReference(
  referenceImages: string[]
): Promise<{ editRef: string; imageBuffer: Buffer } | null> {
  if (referenceImages.length === 0) return null;

  const editIdx = Math.floor(Math.random() * referenceImages.length);
  const editRef = referenceImages[editIdx];
  console.log("[OPENAI] Carousel — locked reference at index", editIdx, "of", referenceImages.length);

  let refUrl = editRef;
  if (refUrl.startsWith("data:") && !refUrl.match(/^data:image\/(png|jpeg|gif|webp)/)) {
    refUrl = refUrl.replace(/^data:[^;]+;/, "data:image/jpeg;");
  }
  const base64Data = refUrl.replace(/^data:image\/\w+;base64,/, "");
  const rawImageBuffer = Buffer.from(base64Data, "base64");
  const imageBuffer = await sharp(rawImageBuffer).modulate({ saturation: 0 }).png().toBuffer();

  return { editRef, imageBuffer };
}

// Language + ecommerce instructions appended to image prompts. Drives both
// the single Image post and (via the planner) the Carousel. Empty when neither
// is set, so default behavior is unchanged.
function advancedPromptAddon(style: Partial<StyleGuideData> | null | undefined): string {
  if (!style) return "";
  const parts: string[] = [];
  if (style.language && style.language !== "English") {
    parts.push(` All visible text in the image (headline, subtext, captions) MUST be written in ${style.language}, using correct, natural ${style.language}.`);
  }
  const e = style.ecommerce;
  if (e && e.enabled) {
    const bits: string[] = [];
    if (e.productName) bits.push(`the product "${e.productName}"`);
    if (e.productDescription) bits.push(`described as: ${e.productDescription}`);
    if (e.salePrice) bits.push(`on sale at ${e.salePrice}${e.price ? ` (was ${e.price})` : ""}`);
    else if (e.price) bits.push(`priced ${e.price}`);
    if (e.promoCode) bits.push(`promo code ${e.promoCode}`);
    if (e.shopCta) bits.push(`a clear "${e.shopCta}" call-to-action`);
    if (bits.length) {
      parts.push(` This is an ecommerce product promotion: feature ${bits.join(", ")}. Make the product the hero of the composition and keep any price and call-to-action legible.`);
    }
  }
  return parts.join("");
}

async function structuredPipeline(
  client: OpenAI,
  userPrompt: string,
  referenceImages: string[],
  style: Partial<StyleGuideData> | null | undefined,
  size: "1024x1024" | "1024x1536" | "1536x1024",
  platform?: string,
  brandName?: string | null,
  quality: ImageQuality = "medium",
  productImage?: string | null
): Promise<ImageGenerationResponse> {

  // ========== STEP 1: Reference → Base Prompt JSON ==========
  console.log("[OPENAI] Step 1: Extracting visual DNA from reference...");
  const basePromptJSON = await extractVisualDNA(client, referenceImages);

  // ========== STEP 1.5: Creative Direction (layout + background variety) ==========
  // This is what stops every generation from reusing the same composition.
  // Content-aware pick from the brand's extracted layout archetypes (or a
  // generic fallback set if none exist yet), random tiebreak among equally
  // good fits. Background pattern is fully AI-decided, no manual control.
  console.log("[OPENAI] Step 1.5: Picking creative direction...");

  const direction = await pickCreativeDirection(
    client,
    userPrompt,
    (style?.layoutArchetypes as unknown as LayoutArchetype[] | undefined) || null,
    style?.tone
  );
  console.log("[OPENAI] Step 1.5: Layout →", direction.layoutName, "| Background →", direction.backgroundPattern);

  // ========== STEP 1.5b: Visual Subject Reasoning ==========
  // What should this graphic actually SHOW? Not layout, not colors — the
  // literal subject matter. Reasons about the message content rather than
  // defaulting to the brand mascot/reference subject every time.
  console.log("[OPENAI] Step 1.5b: Reasoning about visual subject...");
  const visualSubject = await pickVisualSubject(client, userPrompt, brandName, style?.tone);
  console.log("[OPENAI] Step 1.5b: Visual subject →", visualSubject);

  // ========== STEP 1.6: Inspiration Injection ==========
  // Style stays locked to the brand's own reference (Step 1 above).
  // This borrows ONE structural technique — never colors/fonts —
  // from the curated inspiration pool, matched by platform + mood.
  // Silent by design: never surfaced in the chat response.
  console.log("[OPENAI] Step 1.6: Checking inspiration pool...");

  let borrowedTechnique: string | null = null;
  try {
    const pick = await pickInspiration(client, platform, style?.tone);
    if (pick) {
      borrowedTechnique = pick.technique;
      console.log("[OPENAI] Step 1.6: Technique injected (silent)");
    } else {
      console.log("[OPENAI] Step 1.6: No inspiration match, proceeding on brand reference alone");
    }
  } catch (err) {
    console.error("[OPENAI] Step 1.6 failed, skipping injection:", err);
  }

  // ========== STEP 2: Add Brand Content ==========
  console.log("[OPENAI] Step 2: Adding brand content layer...");

  const brandLayer = {
    content: userPrompt,
    brand_colors: {
      primary: style?.primaryColor || "#1A1A1A",
      accent: style?.accentColor || "#00A8E8",
      secondary: style?.secondaryColor || "#FFFFFF",
      background: style?.backgroundColor || null, // null = let visual DNA decide, as before
    },
    tone: style?.tone || "bold",
    font: style?.headingFont || "Inter",
  };

  console.log("[OPENAI] 🎨 ===== RESOLVED COLORS FOR THIS GENERATION =====");
  console.log("[OPENAI] 🎨 primary:   ", brandLayer.brand_colors.primary, style?.primaryColor ? "(from brand)" : "(DEFAULT — no brand color set!)");
  console.log("[OPENAI] 🎨 accent:    ", brandLayer.brand_colors.accent, style?.accentColor ? "(from brand)" : "(DEFAULT — no brand color set!)");
  console.log("[OPENAI] 🎨 secondary: ", brandLayer.brand_colors.secondary, style?.secondaryColor ? "(from brand)" : "(DEFAULT — no brand color set!)");
  console.log("[OPENAI] 🎨 background:", brandLayer.brand_colors.background ?? "(not enforced — AI decides from reference)");
  console.log("[OPENAI] 🎨 ================================================");

  // ========== STEP 3: Build Final Prompt ==========
  let finalPrompt = buildFinalPrompt(basePromptJSON, brandLayer, size, borrowedTechnique, direction, visualSubject) + advancedPromptAddon(style);
  if (productImage) finalPrompt += PRODUCT_RULE;
  console.log("[OPENAI] Step 3: ===== FULL FINAL PROMPT SENT TO gpt-image-2 =====");
  console.log(finalPrompt);
  console.log("[OPENAI] Step 3: ===== END FULL FINAL PROMPT =====");

  // ========== STEP 4: Generate with Reference ==========
  console.log("[OPENAI] Step 4: Generating image at", size, "quality: high...");

// Default to the MOST RECENTLY UPLOADED reference — referenceImages is
// always appended-to (new uploads go on the end, both at onboarding and
// in Settings), so the last element is reliably the newest one. This
// replaces the old "largest file size" heuristic, which had no relation
// to which reference the user actually intended to use for this
// generation and often picked an old, unrelated upload.
// Pick RANDOMLY from the reference pool as the edit-base image. With a
// grid reference exploded into its individual panels (see analyze route),
// this means each generation can land on a different panel — real
// variety across generations, matching how layout/subject already vary,
// instead of always reusing the same single image as the visual anchor.
const editIdx = Math.floor(Math.random() * referenceImages.length);
let editRef = referenceImages[editIdx];
console.log("[OPENAI] Picked reference at random — index", editIdx, "of", referenceImages.length, "—", Math.round(editRef.length / 1024), "KB (base64)");

let refUrl = editRef;
  if (refUrl.startsWith("data:") && !refUrl.match(/^data:image\/(png|jpeg|gif|webp)/)) {
    refUrl = refUrl.replace(/^data:[^;]+;/, "data:image/jpeg;");
  }
  const base64Data = refUrl.replace(/^data:image\/\w+;base64,/, "");
  const rawImageBuffer = Buffer.from(base64Data, "base64");

  // Strip color entirely before this reaches images.edit. Text instructions
  // alone weren't enough — the model can see the reference's actual pixels
  // and was copying its colors regardless of what the prompt said. With
  // saturation zeroed out, structure/composition/lighting/layout survive
  // completely intact, but there's no color left for the model to copy —
  // the brand colors stated in the prompt become the only color source.
  const imageBuffer = await sharp(rawImageBuffer).modulate({ saturation: 0 }).png().toBuffer();
  const imageFile = await toFile(imageBuffer, "reference.png", { type: "image/png" });

  console.log("[OPENAI] Reference size:", Math.round(imageBuffer.length / 1024), "KB");

  // When a product image is attached, pass BOTH the (desaturated) style
  // reference and the (full-color) product to images.edit so the model keeps
  // the brand's layout/technique while reproducing the real product.
  const editImage = productImage
    ? [imageFile, await productToFile(productImage)]
    : imageFile;
  if (productImage) console.log("[OPENAI] 🛍️ Product image attached — passing to images.edit as hero element");

  const response = await withRetry(() =>
    client.images.edit({
      model: "gpt-image-2",
      image: editImage,
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
    })
  );

  const imageData = response.data?.[0] as Record<string, unknown> | undefined;

  let url = "";
  if (imageData?.url) {
    url = imageData.url as string;
  } else if (imageData?.b64_json) {
    url = `data:image/png;base64,${imageData.b64_json}`;
    console.log("[OPENAI] ✅ HIGH QUALITY image generated! Size:", size, "Length:", url.length);
  }

  return {
    url,
    revisedPrompt: finalPrompt,
    compositionText: direction?.layoutComposition || (basePromptJSON.composition as string | undefined),
  };
}

// ==================== Build Final Prompt from JSON + Brand ==========

// ==================== Contrast-Aware Text Color ====================
// Never blindly use the brand's "secondary" swatch as body/subtext color
// — that only makes sense against a dark background (e.g. white text on
// black). If the background this generation is actually using is light,
// white text becomes nearly invisible against it. Computes real relative
// luminance and picks a readable color instead of assuming.

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0.5; // unknown format, assume mid-tone
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.5;
}

// Picks a readable text color for a KNOWN background. Prefers the
// brand's actual secondary color when it already has good contrast;
// only overrides it (falling back to near-black or near-white) when the
// secondary color would be unreadable against this specific background.
function getReadableTextColor(secondary: string, backgroundHex: string): string {
  const bgLight = isLightColor(backgroundHex);
  const secondaryLight = isLightColor(secondary);
  if (bgLight !== secondaryLight) return secondary; // good contrast already
  return bgLight ? "#1A1A1A" : "#FFFFFF"; // secondary would clash — override
}

export function buildFinalPrompt(
  visualDNA: Record<string, unknown>,
  brand: {
    content: string;
    brand_colors: { primary: string; accent: string; secondary: string; background: string | null };
    tone: string;
    font: string;
  },
  size: string,
  borrowedTechnique?: string | null,
  creativeDirection?: { layoutComposition: string | null; backgroundPattern: string } | null,
  visualSubject?: string | null
): string {
  const orientation = size === "1024x1536" ? "vertical/portrait" :
                      size === "1536x1024" ? "horizontal/landscape" : "square";

  const parts: string[] = [];

  // Visual foundation from reference
  parts.push(`Create a premium ${orientation} social media graphic.`);

  // Visual subject — what the graphic actually illustrates, reasoned from
  // the content rather than reused from the reference every time. Stated
  // early and clearly since it drives the main illustration, not just a
  // supporting detail.
  if (visualSubject) {
    parts.push(`Main illustration/subject: ${visualSubject}`);
  }

  // ==================== Color Directive (stated FIRST and loudest) ====================
  // The reference image is also passed to the model as the literal edit-base
  // image, so its own colors compete with anything said in text. State the
  // mandatory brand colors up front, explicitly telling the model to ignore
  // whatever colors it sees in the reference photo — the reference is for
  // STRUCTURE/LAYOUT/TECHNIQUE only, never for color.
  const bgColorNote = brand.brand_colors.background
    ? `background ${brand.brand_colors.background}, `
    : "";

  // When the background is explicitly enforced, we know its exact value
  // ahead of time — compute a text color that will actually be readable
  // against it, rather than blindly assuming the secondary swatch works.
  // When the background is AI-decided, we can't know it in advance, so
  // give an explicit contrast rule instead of a fixed color.
  const textColorNote = brand.brand_colors.background
    ? getReadableTextColor(brand.brand_colors.secondary, brand.brand_colors.background)
    : brand.brand_colors.secondary;
  const contrastInstruction = brand.brand_colors.background
    ? ""
    : ` Whatever background you choose, body/subtext text color MUST have strong contrast against it — never light text on a light background, never dark text on a dark background, even if that means departing from the ${brand.brand_colors.secondary} secondary swatch for body text specifically.`;

  parts.push(
    `CRITICAL COLOR RULE: Use ONLY these exact brand colors — ${bgColorNote}primary ${brand.brand_colors.primary}, accent ${brand.brand_colors.accent}, text/secondary ${textColorNote}. These colors apply to the BACKGROUND, UI elements, glows, highlights, and text. They do NOT apply to human figures, characters, or naturalistic/photographic subjects — those must render in natural, realistic color (real skin tones, real material colors), never tinted or washed in the brand color. The scene should read as naturally colored with brand color as an accent, not as if the entire image were recolored a single hue. Completely IGNORE and DISREGARD any colors visible in the reference image provided — the reference is being used purely for its LAYOUT, COMPOSITION, and STYLISTIC TECHNIQUE, never for color. Do not let any reference-image color bleed into the output.${contrastInstruction}`
  );

  // CRITICAL — the real logo is composited on top pixel-exact AFTER
  // generation (see logoComposite.ts). If the model also draws its own
  // interpretation of a logo/wordmark, you end up with two different
  // brand marks in the same image — one real, one hallucinated. The
  // model must never attempt to draw one at all.
  parts.push(
    `CRITICAL — DO NOT DRAW A LOGO: Do not render any logo, brand icon, wordmark, or stylized lockup of the brand name anywhere in the image, even if the reference shows one — the real logo is added separately after generation and must not be duplicated or reinterpreted here. Do not invent an icon, badge, or symbol to represent the brand. If the brand name needs to appear as plain text (e.g. in a caption, URL, or footer line), that's fine — write it as ordinary text in the chosen typography, not as a designed logo mark.`
  );

  // Background — an explicit brand background color is enforced as the
  // base; the reference's own background description and the chosen
  // pattern (Step 1.5) layer on top of it as texture, not a color override.
  // With no explicit color set, falls back to the reference's own
  // background exactly as before.
  if (brand.brand_colors.background) {
    parts.push(`Background base color: ${brand.brand_colors.background}. This MUST be the dominant background color.`);
    if (visualDNA.background) {
      parts.push(`Background texture/depth cues (apply as texture on top of the base color, do not override it): ${visualDNA.background}`);
    }
  } else if (visualDNA.background) {
    parts.push(`Background: ${visualDNA.background}`);
  }
  if (creativeDirection?.backgroundPattern) {
    parts.push(`Background pattern treatment: ${creativeDirection.backgroundPattern}`);
  }
  if (visualDNA.lighting) parts.push(`Lighting: ${visualDNA.lighting}`);
  if (visualDNA.mood) parts.push(`Mood: ${visualDNA.mood}`);
  if (visualDNA.motion_effects) parts.push(`Motion effects: ${visualDNA.motion_effects}`);
  if (visualDNA.material_quality) parts.push(`Material quality: ${visualDNA.material_quality}`);
  if (visualDNA.distinctive_elements) parts.push(`Style signatures: ${visualDNA.distinctive_elements}`);

  // Brand content layer
  parts.push(`Content: ${brand.content}`);
  parts.push(`Reminder — brand colors: primary ${brand.brand_colors.primary}, accent ${brand.brand_colors.accent}, text ${textColorNote}. The accent color MUST be visible as glows, highlights, or key elements. No other colors from the reference should appear.`);

  // Typography — stated assertively since the Content field above (drafted
  // separately) often defaults to generic "bold all-caps" phrasing that
  // doesn't match the brand's actual reference. This line is the real
  // source of truth for case/weight and overrides anything implied above.
  if (visualDNA.typography_style) {
    parts.push(`CRITICAL TYPOGRAPHY RULE: The brand's actual reference shows this exact type treatment — ${visualDNA.typography_style}. This is the ONLY source for font WEIGHT — follow it exactly, per text level (the headline may be Bold while the subheading and body text are Regular or Medium; do not apply the headline's boldness to every piece of text). Font shape/personality (in the spirit of ${brand.font}): ${getFontStyleDescriptor(brand.font)} — this describes letterform SHAPE and character only, it does NOT specify weight; weight comes exclusively from the extracted description above. Do not default to all-caps or maximum boldness anywhere unless the extracted description explicitly says so for that specific text level.`);
  } else {
    parts.push(`Typography: moderate weight, natural mixed-case (not all-caps by default), ${getFontStyleDescriptor(brand.font)} (in the spirit of ${brand.font}), clear but proportionate size hierarchy.`);
  }

  // Composition — when there's a real archetype library (from a grid
  // reference), the creative director already picked among genuine
  // reference-derived layouts, which itself is the requested variety.
  // With a single reference and no archetype library, visualDNA.composition
  // is the ONLY signal — it needs to be stated assertively (like color and
  // typography) or the model falls back to its own habitual top-left bias.
  // Mostly follows the reference's real alignment exactly, with an
  // occasional deliberate switch-up for variety, as requested.
  const hasRealLayoutChoice = !!creativeDirection?.layoutComposition;
  const compositionText = creativeDirection?.layoutComposition || (visualDNA.composition as string | undefined);
  if (compositionText) {
    if (hasRealLayoutChoice) {
      parts.push(`Composition: ${compositionText}`);
    } else if (Math.random() < 0.2) {
      // ~1 in 5 generations — deliberate variation, not a bug
      parts.push(`Composition: The brand's reference shows this arrangement — ${compositionText}. For THIS generation specifically, shift the alignment somewhat differently (a different horizontal or vertical anchor) for variety, while keeping the same general spirit and hierarchy.`);
    } else {
      parts.push(`CRITICAL COMPOSITION RULE: The brand's actual reference shows this exact arrangement — ${compositionText}. Follow this alignment and element placement precisely, exactly as described — this is not a loose suggestion. If it specifies left-aligned/center-aligned/right-aligned and top/middle/bottom positioning, the output must actually match that, not default to top-left out of habit.`);
    }
  }

  // Borrowed creative accent (Step 1.6) — a single technique layered on
  // top of the locked brand style, never replacing colors or typography.
  if (borrowedTechnique) {
    parts.push(`Creative accent (apply subtly, do not override brand colors or typography): ${borrowedTechnique}`);
  }

  // Quality
  parts.push(`Ultra high quality, sharp details, professional grade, no cropping issues, full ${orientation} frame with proper margins. All text must be fully visible and not cut off at edges.`);

  return parts.join(". ");
}

// ==================== Standard Generation (no references) ====================

async function standardGenerate(
  client: OpenAI,
  prompt: string,
  style: Partial<StyleGuideData> | null | undefined,
  size: "1024x1024" | "1024x1536" | "1536x1024",
  quality: ImageQuality = "medium",
  productImage?: string | null
): Promise<ImageGenerationResponse> {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

  // Always apply brand colors, even with no style guide passed in at all —
  // fall back to the same defaults the reference-based pipeline uses,
  // rather than silently generating with no color guidance whatsoever.
  const primary = style?.primaryColor || "#1A1A1A";
  const accent = style?.accentColor || "#00A8E8";
  const secondary = style?.secondaryColor || "#FFFFFF";
  const bgNote = style?.backgroundColor ? ` background ${style.backgroundColor},` : "";
  const tone = style?.tone || "bold";

  // Same contrast-awareness as the main pipeline — don't blindly use the
  // secondary swatch as text color if it would clash with a known background.
  const textColor = style?.backgroundColor ? getReadableTextColor(secondary, style.backgroundColor) : secondary;
  const contrastNote = style?.backgroundColor
    ? ""
    : ` Whatever background results, body text MUST have strong contrast against it — never light-on-light or dark-on-dark, even if that means departing from the ${secondary} secondary swatch for body text specifically.`;

  // Same emphatic treatment as the main pipeline — a single trailing
  // sentence was too weak for the model to reliably prioritize over its
  // own stylistic instincts (e.g. defaulting to a dark "coming soon" look).
  const styledPrompt = `CRITICAL COLOR RULE: Use ONLY these exact brand colors —${bgNote} primary ${primary}, accent ${accent}, text/secondary ${textColor}. These MUST be followed exactly, especially the background color which MUST be the dominant background of the entire image. These colors apply to background, UI elements, glows, highlights, and text — NOT to human figures, characters, or naturalistic subjects, which must render in natural, realistic color rather than being tinted in the brand hue.${contrastNote} Tone: ${tone}. CRITICAL — DO NOT DRAW A LOGO: do not render any logo, brand icon, wordmark, or stylized brand lockup — that gets added separately after generation. Plain brand-name text is fine if it fits naturally, but not a designed logo mark. ${prompt}` + advancedPromptAddon(style);

  console.log("[OPENAI] Standard generation with", model, "at", quality, "quality, size:", size, productImage ? "(with product image)" : "");

  // With a product image and no style reference, edit the product directly so
  // it is preserved as the hero element instead of being described from text.
  const response = productImage
    ? await withRetry(async () =>
        client.images.edit({
          model,
          image: await productToFile(productImage),
          prompt: styledPrompt + PRODUCT_RULE,
          n: 1,
          size,
          quality,
        })
      )
    : await client.images.generate({
        model,
        prompt: styledPrompt,
        n: 1,
        size,
        quality,
      });

  const imageData = response.data?.[0] as Record<string, unknown> | undefined;

  let url = "";
  if (imageData?.url) {
    url = imageData.url as string;
  } else if (imageData?.b64_json) {
    url = `data:image/png;base64,${imageData.b64_json}`;
    console.log("[OPENAI] ✅ Standard image generated! Length:", url.length);
  }

  return { url, revisedPrompt: styledPrompt };
}
// ==================== Template (prompt-recipe) generation ====================
export function templateQuality(q?: ImageQuality): ImageQuality {
  return q || ((process.env.OPENAI_IMAGE_QUALITY_TEMPLATE || process.env.OPENAI_IMAGE_QUALITY_EDIT || "medium") as ImageQuality);
}
export function templateSize(size: string): "1024x1024" | "1024x1536" | "1536x1024" {
  return size === "1080x1080" ? "1024x1024" : size === "1920x1080" ? "1536x1024" : "1024x1536";
}
// Design templates carry their own complete art direction, so the prompt goes
// to the model as-is: no brand-colour wrapper, no style-reference pipeline.
// With a product photo it's an edit of that photo (so the pack stays exact);
// without one it's a plain generation.
export async function openaiTemplateImage(opts: {
  prompt: string;
  size: string; // e.g. "1080x1920"
  productImage?: string | null;
  quality?: ImageQuality;
}): Promise<ImageGenerationResponse & { usage: unknown; size: string; quality: string }> {
  const client = getClient();
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const sizeMap: Record<string, "1024x1024" | "1024x1536" | "1536x1024"> = {
    "1080x1080": "1024x1024",
    "1080x1920": "1024x1536",
    "1000x1500": "1024x1536",
    "1920x1080": "1536x1024",
  };
  const size = sizeMap[opts.size] || "1024x1536";
  const quality = templateQuality(opts.quality);

  console.log("[OPENAI] Template generation", model, size, quality, opts.productImage ? "(with product)" : "");

  const response = opts.productImage
    ? await withRetry(async () =>
        client.images.edit({ model, image: await productToFile(opts.productImage!), prompt: opts.prompt, n: 1, size, quality }),
      )
    : await withRetry(async () => client.images.generate({ model, prompt: opts.prompt, n: 1, size, quality }));

  const d = response.data?.[0] as Record<string, unknown> | undefined;
  const url = d?.url ? String(d.url) : d?.b64_json ? `data:image/png;base64,${d.b64_json}` : "";
  if (!url) throw new Error("No image returned");
  return { url, revisedPrompt: opts.prompt, usage: (response as { usage?: unknown }).usage ?? null, size, quality };
}
