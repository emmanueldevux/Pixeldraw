// ============================================================
// UXLLY — Carousel Generation
// Generates every slide of a planned carousel as one cohesive set.
//
// LOCKED once for the whole carousel (so it reads as ONE carousel,
// not N unrelated posts):
//   - the reference image (and its desaturated edit-base buffer)
//   - the extracted visual DNA (background texture, lighting, material)
//   - the background pattern treatment
//   - the logo placement (position + scale)
//
// VARIES per slide (this is what keeps it from feeling repetitive):
//   - the layout/composition (content-aware per slide, via the same
//     creative director used for single posts)
//   - the visual subject (comes straight from the carousel plan's
//     per-slide visualSubjectHint — already narrative-aware)
//   - the actual headline/body copy
// ============================================================

import { toFile } from "openai";
import type { StyleGuideData, ImageSize } from "@/types";
import {
  getClient,
  withRetry,
  extractVisualDNA,
  prepareDesaturatedReference,
  buildFinalPrompt,
} from "@/lib/ai/providers/openai";
import { pickCreativeDirection } from "@/lib/ai/creativeDirector";
import { compositeLogo, pickLogoPlacement, type LogoPosition } from "@/lib/ai/logoComposite";
import type { CarouselPlan } from "@/lib/ai/carouselPlanner";
import type { LayoutArchetype } from "@/types";

export interface GeneratedSlide {
  slideNumber: number;
  role: string;
  headline: string;
  body: string;
  imageUrl: string;
}

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

// Used for TikTok slideshows: the model draws only the background and subject.
// The caption is added afterwards in the editor, so it stays editable.
const NO_TEXT_RULE =
  " ABSOLUTE RULE: render NO text of any kind in this image — no letters, words, numbers, captions, labels, watermarks, or UI elements. This is a clean background and subject only; the caption is added by the designer afterwards.";

export async function generateCarouselSlides(params: {
  plan: CarouselPlan;
  referenceImages: string[]; // already resolved: carousel-specific pool, or brand fallback
  styleGuide: Partial<StyleGuideData> | null;
  brandName?: string | null;
  size: ImageSize;
  logoUrl?: string | null;
  logoPosition?: LogoPosition; // explicit lock from brand settings, if any
  logoScale?: number;
  noText?: boolean; // true for TikTok slideshows: background-only images
}): Promise<GeneratedSlide[]> {
  const { plan, referenceImages, styleGuide, brandName, size, logoUrl, logoPosition, logoScale, noText } = params;
  const client = getClient();
  const imageSize = sizeMap[params.size as string] || "1024x1536";

  console.log("[CAROUSEL] 🎬 Generating", plan.totalSlides, "slides —", referenceImages.length, "references available");

  // ========== LOCK: reference + visual DNA (once for the whole set) ==========
  const prepared = await prepareDesaturatedReference(referenceImages);
  const visualDNA = prepared ? await extractVisualDNA(client, [prepared.editRef]) : {};

  // ========== LOCK: layout composition AND background pattern (once) ==========
  // A carousel should read as ONE cohesive piece with a consistent shell —
  // same text alignment/position pattern on every slide — with only the
  // actual content and subject changing slide to slide. Picking a fresh
  // layout per slide (varying alignment, position) is exactly what made
  // consecutive slides feel inconsistent/broken rather than intentional.
  const direction = await pickCreativeDirection(
    client,
    plan.topic,
    (styleGuide?.layoutArchetypes as unknown as LayoutArchetype[] | undefined) || null,
    styleGuide?.tone
  );
  const lockedBackgroundPattern = direction.backgroundPattern;
  const lockedLayoutComposition = direction.layoutComposition;
  console.log("[CAROUSEL] 🔒 Locked layout + background for entire carousel:", lockedBackgroundPattern, "| reference:", prepared ? "yes" : "no (text-only)");

  // ========== LOCK: logo placement (once, respects an explicit brand setting) ==========
  const placement = logoUrl
    ? logoPosition
      ? { position: logoPosition, scale: logoScale ?? 0.14 }
      : pickLogoPlacement()
    : null;
  if (placement) {
    console.log("[CAROUSEL] 🔒 Locked logo placement:", placement.position, `(${Math.round(placement.scale * 100)}%)`, logoPosition ? "[brand-locked]" : "[auto-picked once]");
  }

  const brandColors = {
    primary: styleGuide?.primaryColor || "#1A1A1A",
    accent: styleGuide?.accentColor || "#00A8E8",
    secondary: styleGuide?.secondaryColor || "#FFFFFF",
    background: styleGuide?.backgroundColor || null,
  };

  const results: GeneratedSlide[] = [];

  for (const slide of plan.slides) {
    console.log(`[CAROUSEL] === Slide ${slide.slideNumber}/${plan.totalSlides} (${slide.role}) ===`);

    try {
      // Build this slide's content block — the narrative beats (pattern
      // interrupt / forward hook) get folded in as guidance, not literal
      // on-image text, so the visible copy stays clean.
      const contentParts = noText
        ? [
            `Slide ${slide.slideNumber} of ${plan.totalSlides} in a carousel (role: ${slide.role}).`,
            `The image should visually support this message without writing it: "${slide.headline}".`,
            "Leave calm, uncluttered space in the upper and lower thirds for a caption that is added later.",
            slide.patternInterrupt ? `Visual framing should reflect: ${slide.patternInterrupt}` : "",
          ].filter(Boolean).join(" ")
        : [
            `Slide ${slide.slideNumber} of ${plan.totalSlides} in a carousel (role: ${slide.role}).`,
            `Headline text to display: "${slide.headline}"`,
            slide.body ? `Supporting text to display: "${slide.body}"` : "",
            slide.role === "cta" && slide.ctaText ? `Call-to-action text to display: "${slide.ctaText}"` : "",
            slide.patternInterrupt ? `Visual framing should reflect: ${slide.patternInterrupt}` : "",
          ].filter(Boolean).join(" ");

      const brandLayer = {
        content: contentParts,
        brand_colors: brandColors,
        tone: styleGuide?.tone || "bold",
        font: styleGuide?.headingFont || "Inter",
      };

      const basePrompt = buildFinalPrompt(
        visualDNA,
        brandLayer,
        imageSize,
        null, // no inspiration injection for carousel slides — kept simpler/faster
        { layoutComposition: lockedLayoutComposition, backgroundPattern: lockedBackgroundPattern },
        slide.visualSubjectHint
      );

      const finalPrompt = noText ? basePrompt + NO_TEXT_RULE : basePrompt;

      let url = "";

      if (prepared) {
        const imageFile = await toFile(prepared.imageBuffer, "reference.png", { type: "image/png" });
        const response = await withRetry(() =>
          client.images.edit({
            model: "gpt-image-2",
            image: imageFile,
            prompt: finalPrompt,
            n: 1,
            size: imageSize,
            quality: "high",
          })
        );
        const imageData = response.data?.[0] as Record<string, unknown> | undefined;
        if (imageData?.url) url = imageData.url as string;
        else if (imageData?.b64_json) url = `data:image/png;base64,${imageData.b64_json}`;
      } else {
        const response = await withRetry(() =>
          client.images.generate({
            model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
            prompt: finalPrompt,
            n: 1,
            size: imageSize,
            quality: "high",
          })
        );
        const imageData = response.data?.[0] as Record<string, unknown> | undefined;
        if (imageData?.url) url = imageData.url as string;
        else if (imageData?.b64_json) url = `data:image/png;base64,${imageData.b64_json}`;
      }

      // Same locked logo placement composited on every slide — this is
      // what makes the set read as one branded carousel.
      if (placement && logoUrl && url) {
        try {
          url = await compositeLogo(url, logoUrl, placement.position, placement.scale);
        } catch (err) {
          console.error(`[CAROUSEL] Logo compositing failed on slide ${slide.slideNumber}:`, err);
        }
      }

      results.push({
        slideNumber: slide.slideNumber,
        role: slide.role,
        headline: slide.headline,
        body: slide.body,
        imageUrl: url,
      });
      console.log(`[CAROUSEL] ✅ Slide ${slide.slideNumber} done`);
    } catch (err) {
      console.error(`[CAROUSEL] ❌ Slide ${slide.slideNumber} failed:`, err);
      // Push a placeholder so one failed slide doesn't lose the rest —
      // caller can decide whether to retry that slide alone.
      results.push({
        slideNumber: slide.slideNumber,
        role: slide.role,
        headline: slide.headline,
        body: slide.body,
        imageUrl: "",
      });
    }
  }

  console.log("[CAROUSEL] 🎬 Done —", results.filter((r) => r.imageUrl).length, "/", results.length, "slides generated successfully");
  return results;
}