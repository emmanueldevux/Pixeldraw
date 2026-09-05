// ============================================================
// UXLLY — OpenAI Provider
// Structured prompt pipeline:
// 1. GPT-4o sees reference → extracts visual DNA as JSON
// 2. System adds brand content (text, colors, positions)
// 3. Combined prompt + reference → gpt-image-1 generates
// ============================================================

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
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

export function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
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
  }
): Promise<ImageGenerationResponse> {
  const client = getClient();
  const refs = request.referenceImages || [];
  const style = request.styleGuide;
  const platform = request.platform;
  const brandName = request.brandName;

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
      result = await structuredPipeline(client, request.prompt, refs, style, imageSize, platform, brandName);
    } catch (err) {
      console.error("[OPENAI] Pipeline failed:", err);
      result = await standardGenerate(client, request.prompt, style, imageSize);
    }
  } else {
    result = await standardGenerate(client, request.prompt, style, imageSize);
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
    model: "gpt-4o",
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

async function structuredPipeline(
  client: OpenAI,
  userPrompt: string,
  referenceImages: string[],
  style: Partial<StyleGuideData> | null | undefined,
  size: "1024x1024" | "1024x1536" | "1536x1024",
  platform?: string,
  brandName?: string | null
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
  const finalPrompt = buildFinalPrompt(basePromptJSON, brandLayer, size, borrowedTechnique, direction, visualSubject);
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

  const response = await withRetry(() =>
    client.images.edit({
      model: "gpt-image-2",
      image: imageFile,
      prompt: finalPrompt,
      n: 1,
      size,
      quality: "high",
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
  parts.push(
    `CRITICAL COLOR RULE: Use ONLY these exact brand colors — ${bgColorNote}primary ${brand.brand_colors.primary}, accent ${brand.brand_colors.accent}, text/secondary ${brand.brand_colors.secondary}. Completely IGNORE and DISREGARD any colors visible in the reference image provided — the reference is being used purely for its LAYOUT, COMPOSITION, and STYLISTIC TECHNIQUE, never for color. Do not let any reference-image color bleed into the output.`
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
  parts.push(`Reminder — brand colors: primary ${brand.brand_colors.primary}, accent ${brand.brand_colors.accent}, text ${brand.brand_colors.secondary}. The accent color MUST be visible as glows, highlights, or key elements. No other colors from the reference should appear.`);

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
  size: "1024x1024" | "1024x1536" | "1536x1024"
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

  // Same emphatic treatment as the main pipeline — a single trailing
  // sentence was too weak for the model to reliably prioritize over its
  // own stylistic instincts (e.g. defaulting to a dark "coming soon" look).
  const styledPrompt = `CRITICAL COLOR RULE: Use ONLY these exact brand colors —${bgNote} primary ${primary}, accent ${accent}, text/secondary ${secondary}. These MUST be followed exactly, especially the background color which MUST be the dominant background of the entire image. Tone: ${tone}. CRITICAL — DO NOT DRAW A LOGO: do not render any logo, brand icon, wordmark, or stylized brand lockup — that gets added separately after generation. Plain brand-name text is fine if it fits naturally, but not a designed logo mark. ${prompt}`;

  console.log("[OPENAI] Standard generation with", model, "at high quality, size:", size);

  const response = await client.images.generate({
    model,
    prompt: styledPrompt,
    n: 1,
    size,
    quality: "high",
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