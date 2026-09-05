// ============================================================
// UXLLY — AI Chat API Route
// Connects to modular AI provider with skill-enhanced prompts
// Auto-generates images via Together AI (free) or OpenAI
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// Vercel: generation regularly takes 100-130s. Requires Fluid Compute
// enabled on the project (Vercel dashboard → Settings → Functions) —
// without it, this value is capped much lower (10-60s) and every
// generation will time out with a 504 regardless of this setting.
export const maxDuration = 300;
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/skills";
import { extractImagePrompt } from "@/lib/utils";
import { openaiGenerateImage } from "@/lib/ai/providers/openai";
import { togetherGenerateImage } from "@/lib/ai/providers/together";
import type { AIMessage, ImageSize, StyleGuideData } from "@/types";
import type { LogoPosition } from "@/lib/ai/logoComposite";
import { getRandomTemplateAsBase64 } from "@/lib/templates";

// Pick the right image provider based on what's configured
async function generateImage(
  prompt: string,
  size: string,
  referenceImages?: string[],
  styleGuide?: Record<string, unknown> | null,
  platform?: string,
  brandName?: string | null,
  logoUrl?: string | null,
  logoPosition?: string | null,
  logoScale?: number | null
) {
  const provider = process.env.IMAGE_PROVIDER || "together";
  const logoOpts = {
    logoUrl,
    logoPosition: (logoPosition as unknown as LogoPosition) || undefined,
    logoScale: logoScale ?? undefined,
  };

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return openaiGenerateImage({ prompt, size: size as ImageSize, referenceImages, styleGuide, platform, brandName, ...logoOpts });
  }

  if (process.env.TOGETHER_API_KEY) {
    return togetherGenerateImage({ prompt, size: size as ImageSize });
  }

  if (process.env.OPENAI_API_KEY) {
    return openaiGenerateImage({ prompt, size: size as ImageSize, referenceImages, styleGuide, platform, brandName, ...logoOpts });
  }

  throw new Error("No image provider configured.");
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, platform, brandId, brandName, channelDescription, styleGuide, channelId } =
      await request.json();

    console.log("[CHAT] 🔑 Received brandId:", brandId, "brandName:", brandName);

    // Load full style guide from DB
    let fullStyleGuide = styleGuide || null;
    let loadedBrand: {
      name: string;
      logo: string | null;
      logoPosition: string;
      logoScale: number;
      styleGuide: { referenceImages: unknown; generationPool: unknown } | null;
    } | null = null;

    const lookupId = brandId;
    if (lookupId) {
      try {
        const brand = await db.brand.findFirst({
          where: { id: lookupId, userId: session.user.id },
          include: { styleGuide: true },
        });

        loadedBrand = brand as any;

        if (brand?.styleGuide) {
          const refImages = brand.styleGuide.referenceImages;
          console.log("[CHAT] 📋 Style guide loaded for:", brand.name, `(brand id: ${brand.id})`);
          console.log("[CHAT] 📋 Analysis:", brand.styleGuide.rawMarkdown ? "YES" : "NO");
          console.log("[CHAT] 📋 referenceImages type:", typeof refImages);
          console.log("[CHAT] 📋 referenceImages isArray:", Array.isArray(refImages));
          console.log("[CHAT] 📋 referenceImages count:", Array.isArray(refImages) ? refImages.length : 0);
          console.log("[CHAT] 🎨 ===== COLORS LOADED FROM DB =====");
          console.log("[CHAT] 🎨 primaryColor:  ", brand.styleGuide.primaryColor);
          console.log("[CHAT] 🎨 secondaryColor:", brand.styleGuide.secondaryColor);
          console.log("[CHAT] 🎨 accentColor:   ", brand.styleGuide.accentColor);
          console.log("[CHAT] 🎨 backgroundColor:", brand.styleGuide.backgroundColor ?? "(not set — AI will decide)");
          console.log("[CHAT] 🎨 ===================================");

          fullStyleGuide = {
            ...fullStyleGuide,
            primaryColor: brand.styleGuide.primaryColor,
            secondaryColor: brand.styleGuide.secondaryColor,
            accentColor: brand.styleGuide.accentColor,
            backgroundColor: brand.styleGuide.backgroundColor ?? undefined,
            headingFont: brand.styleGuide.headingFont,
            tone: brand.styleGuide.tone,
            extraNotes: brand.styleGuide.extraNotes,
            rawMarkdown: brand.styleGuide.rawMarkdown,
            layoutArchetypes: brand.styleGuide.layoutArchetypes as unknown as StyleGuideData["layoutArchetypes"],
          };
        } else {
          console.log("[CHAT] ⚠️ Brand found but no style guide");
        }
      } catch (err) {
        console.error("[CHAT] ❌ Failed to load brand:", err);
      }
    } else {
      console.log("[CHAT] ⚠️ No brandId provided");
    }

    // Build system prompt with skills
    const systemPrompt = buildSystemPrompt(
      ["copywriting", "imagePrompt", "inspirationInjection", "typography"],
      {
        brandName: brandName || "My Brand",
        platform: platform || "instagram_post",
        channelDescription: channelDescription || undefined,
        styleGuide: fullStyleGuide,
      }
    );

    // Prepend system message
    const fullMessages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Call the active AI provider
    const response = await aiComplete({
      messages: fullMessages,
      temperature: 0.7,
      maxTokens: 2048,
    });

    // Check if response contains an auto-extractable image prompt
    let imageUrl: string | undefined;
    const imagePrompt = extractImagePrompt(response.content);
    console.log("[CHAT] 🔍 Extracted image prompt:", imagePrompt ? "YES (" + imagePrompt.slice(0, 60) + "...)" : "NONE");

    // Diagnostic: catch the text model reusing a previous turn's image
    // prompt verbatim instead of actually responding to the new message.
    // This makes the failure visible in logs immediately instead of only
    // showing up as "why is it the same image" several steps downstream.
    if (imagePrompt) {
      const priorAssistantMessages = (messages as AIMessage[])
        .filter((m) => m.role === "assistant")
        .map((m) => extractImagePrompt(m.content))
        .filter((p): p is string => !!p);
      const lastPriorPrompt = priorAssistantMessages[priorAssistantMessages.length - 1];
      if (lastPriorPrompt && lastPriorPrompt.trim() === imagePrompt.trim()) {
        console.warn(
          "[CHAT] ⚠️⚠️⚠️ DUPLICATE PROMPT DETECTED — the text model returned the exact same image prompt as the previous turn, despite a different user message. This means the drafting step failed to engage with the new request."
        );
      }
    }

    if (imagePrompt) {
      try {
        console.log("[CHAT] 🖼️ Auto-generating image...");
        // Prefer the generation pool — grid references get exploded into
        // their individual panels here, giving real variety to pick from.
        // Falls back to the raw reference board if no pool exists yet
        // (e.g. brand hasn't been analyzed, or references are all plain
        // single uploads with nothing to explode). Final fallback: a
        // built-in template, so a brand with zero references of its own
        // still gets a real structural anchor instead of pure text-only
        // generation.
        let refs: string[] = [];
        const rawPool = loadedBrand?.styleGuide?.generationPool;
        if (Array.isArray(rawPool) && rawPool.length > 0) {
          refs = rawPool as string[];
          console.log("[CHAT] 📸 Using generation pool:", refs.length, "images");
        } else if (loadedBrand?.styleGuide?.referenceImages) {
          const rawRefs = loadedBrand.styleGuide.referenceImages;
          if (Array.isArray(rawRefs) && rawRefs.length > 0) {
            refs = rawRefs as string[];
            console.log("[CHAT] 📸 No generation pool yet, using raw reference board:", refs.length, "images");
          }
        }
        if (refs.length === 0) {
          const template = await getRandomTemplateAsBase64();
          if (template) {
            refs = [template];
            console.log("[CHAT] 📸 No brand references at all — using a built-in template as fallback");
          } else {
            console.log("[CHAT] 📸 No brand references and no templates available — generating text-only");
          }
        }

// Map platform to image size
const platformSizes: Record<string, string> = {
  instagram_post: "1080x1080",
  instagram_story: "1080x1920",
  instagram_reel: "1080x1920",
  tiktok: "1080x1920",
  twitter: "1600x900",
  linkedin_post: "1200x627",
  facebook: "1200x630",
  youtube_thumbnail: "1280x720",
  pinterest: "1000x1500",
  threads: "1080x1080",
  snapchat: "1080x1920",
};
const imageSize = platformSizes[platform] || "1080x1080";
console.log("[CHAT] 📐 Platform:", platform, "→ Size:", imageSize);
const imageResponse = await generateImage(
  imagePrompt,
  imageSize,
  refs,
  fullStyleGuide,
  platform,
  loadedBrand?.name || null,
  loadedBrand?.logo || null,
  loadedBrand?.logoPosition || null,
  loadedBrand?.logoScale || null
);

        imageUrl = imageResponse.url;
        console.log("[CHAT] ✅ Image URL:", imageUrl?.slice(0, 80));
      } catch (err) {
        console.error("[CHAT] ❌ Auto image generation failed:", err);
      }
    }

    console.log("[CHAT] 📤 Returning response with imageUrl:", imageUrl ? "YES" : "NO");

    return NextResponse.json({
      content: response.content,
      model: response.model,
      imageUrl,
      usage: response.usage,
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}