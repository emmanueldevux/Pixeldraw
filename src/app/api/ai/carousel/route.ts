// ============================================================
// UXLLY — Carousel Generation API
// Plans a retention-engineered carousel, then generates every
// slide as one cohesive set (locked style/reference, varied
// layout/subject per slide).
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { planCarousel } from "@/lib/ai/carouselPlanner";
import { generateCarouselSlides } from "@/lib/ai/carouselGenerate";
import type { LogoPosition } from "@/lib/ai/logoComposite";
import type { StyleGuideData, LayoutArchetype } from "@/types";

const platformSizes: Record<string, "1080x1080" | "1080x1920" | "1600x900" | "1200x627" | "1200x630" | "1280x720" | "1000x1500"> = {
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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      brandId,
      topic,
      platform,
      slideCount, // number | "auto" | undefined
      ctaGoal,
      referenceImages, // optional — carousel-specific references for THIS carousel only
    } = body;

    if (!brandId || !topic) {
      return NextResponse.json({ error: "brandId and topic are required" }, { status: 400 });
    }

    const brand = await db.brand.findFirst({
      where: { id: brandId, userId: session.user.id },
      include: { styleGuide: true },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const sg = brand.styleGuide;
    const styleGuide: Partial<StyleGuideData> | null = sg
      ? {
          primaryColor: sg.primaryColor,
          secondaryColor: sg.secondaryColor,
          accentColor: sg.accentColor,
          backgroundColor: sg.backgroundColor ?? undefined,
          headingFont: sg.headingFont,
          tone: sg.tone as StyleGuideData["tone"],
          extraNotes: sg.extraNotes ?? undefined,
          rawMarkdown: sg.rawMarkdown ?? undefined,
          layoutArchetypes: sg.layoutArchetypes as unknown as LayoutArchetype[] | undefined,
        }
      : null;

    // ========== Resolve reference pool ==========
    // Your rule: carousel-specific references if provided, otherwise fall
    // back to the brand's regular generation pool (grid panels + uploads),
    // otherwise the raw reference board, otherwise none (text-only).
    let resolvedReferences: string[] = [];
    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
      resolvedReferences = referenceImages;
      console.log("[CAROUSEL API] 📸 Using carousel-specific references:", resolvedReferences.length);
    } else if (Array.isArray(sg?.generationPool) && (sg?.generationPool as string[]).length > 0) {
      resolvedReferences = sg!.generationPool as string[];
      console.log("[CAROUSEL API] 📸 Falling back to brand generation pool:", resolvedReferences.length);
    } else if (Array.isArray(sg?.referenceImages) && (sg?.referenceImages as string[]).length > 0) {
      resolvedReferences = sg!.referenceImages as string[];
      console.log("[CAROUSEL API] 📸 Falling back to raw reference board:", resolvedReferences.length);
    } else {
      console.log("[CAROUSEL API] 📸 No references available — text-only generation");
    }

    // ========== Plan ==========
    console.log("[CAROUSEL API] 📋 Planning carousel for:", brand.name, "| topic:", topic);
    const plan = await planCarousel({
      topic,
      brandName: brand.name,
      platform: platform || "instagram_post",
      styleGuide,
      slideCountHint: typeof slideCount === "number" ? slideCount : "auto",
      ctaGoal,
    });

    // ========== Generate ==========
    const imageSize = platformSizes[platform] || "1080x1080";
    const slides = await generateCarouselSlides({
      plan,
      referenceImages: resolvedReferences,
      styleGuide,
      brandName: brand.name,
      size: imageSize,
      logoUrl: brand.logo || null,
      logoPosition: (brand.logoPosition as LogoPosition | null) || undefined,
      logoScale: brand.logoScale ?? undefined,
    });

    const successCount = slides.filter((s) => s.imageUrl).length;
    console.log("[CAROUSEL API] ✅ Done —", successCount, "/", slides.length, "slides generated");

    return NextResponse.json({
      success: true,
      data: {
        plan: { topic: plan.topic, totalSlides: plan.totalSlides, ctaGoal: plan.ctaGoal },
        slides,
      },
    });
  } catch (error) {
    console.error("[CAROUSEL API] ❌ Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate carousel" },
      { status: 500 }
    );
  }
}
