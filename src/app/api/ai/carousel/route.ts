// ============================================================
// UXLLY — Carousel Generation API
// Plans a retention-engineered carousel, then generates every
// slide as one cohesive set (locked style/reference, varied
// layout/subject per slide).
// ============================================================

import { withUsage, applyProjectNegative } from "@/lib/billing/usage";
import { NextResponse } from "next/server";

// Vercel: a carousel generates several slides sequentially at ~100-130s
// each — this can genuinely run long. 300 is safe on Pro+Fluid Compute
// for shorter carousels; if you're regularly generating 7+ slides,
// raise this toward Pro's 800s ceiling (requires Fluid Compute enabled).
export const maxDuration = 300;
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { planCarousel } from "@/lib/ai/carouselPlanner";
import { generateCarouselSlides } from "@/lib/ai/carouselGenerate";
import type { LogoPosition } from "@/lib/ai/logoComposite";
import type { StyleGuideData, LayoutArchetype } from "@/types";
import { randomUUID } from "crypto";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { insufficientResponse } from "@/lib/billing/http";
import { resolveStyle, bumpStyleUsage } from "@/lib/carousels/store";
import { readProjectCarousel, CAROUSEL_SIZES, type CarouselSize, type SlideImage } from "@/lib/carousels/types";
import { planStyledCarousel } from "@/lib/carousels/planner";
import { chooseRefs, logoPlacementFor } from "@/lib/carousels/generate";
import { createCarouselTask } from "@/lib/carousels/task";
import { getBrain } from "@/lib/brain/generate";
import { brainToPrompt } from "@/lib/brain/prompt";
import { isEmptyBrain } from "@/lib/brain/types";

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

async function handlePOST(request: Request) {
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
      format, // "carousel" | "tiktok_slideshow"
      clientName, // TikTok: the client being promoted, if any
      brandedContent, // TikTok: whether the branded-content disclosure applies
      size, // styled carousels: "4:5" | "1:1" | "9:16"
      detailCount, // styled carousels: number of details pages (default 5)
      slideImages, // styled carousels: [{ target: "intro" | "outro" | "details" | slideNumber, dataUrl }]
      slideNotes, // styled carousels: notes like "slide 1: use my photo"
    } = body;

    const isTikTok = format === "tiktok_slideshow";

    // TikTok slideshows don't need a project: they run on the reference
    // library and a neutral style. Carousels still need a brand.
    if (!topic || (!brandId && !isTikTok)) {
      return NextResponse.json({ error: "brandId and topic are required" }, { status: 400 });
    }

    const brandRecord = brandId
      ? await db.brand.findFirst({
          where: { id: brandId, userId: session.user.id },
          include: { styleGuide: true },
        })
      : null;

    applyProjectNegative((brandRecord?.styleGuide as unknown as { advancedSettings?: unknown } | null)?.advancedSettings);

    if (brandId && !brandRecord) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // ========== Styled carousels (Intro / Details / Outro from admin styles) ==========
    if (!isTikTok && brandRecord) {
      const adv = (brandRecord.styleGuide as unknown as { advancedSettings?: unknown } | null)?.advancedSettings;
      const projectCarousel = readProjectCarousel(adv);
      const style = await resolveStyle(projectCarousel.styleId, session.user.id);
      if (style) {
        const details = Math.min(10, Math.max(1, Math.round(Number(detailCount) || (typeof slideCount === "number" ? slideCount - 2 : 5))));
        const chosenSize: CarouselSize = CAROUSEL_SIZES.includes(size) ? size : "4:5";
        const images: SlideImage[] = Array.isArray(slideImages)
          ? slideImages
              .filter((x: { dataUrl?: unknown }) => typeof x?.dataUrl === "string" && (x.dataUrl as string).startsWith("data:image"))
              .slice(0, 4)
          : [];
        const ref = randomUUID();
        let sAuth;
        try {
          sAuth = await authorize(session.user.id, [{ key: "carousel.plan" }, { key: "image.edit", qty: details + 2 }], { trial: "none" });
        } catch (e) {
          if (e instanceof InsufficientCreditsError) return insufficientResponse(e);
          throw e;
        }
        const brain = await getBrain(brandRecord.id).catch(() => null);
        const sg = brandRecord.styleGuide;
        const plan = await planStyledCarousel({
          topic,
          detailCount: details,
          style,
          brandName: brandRecord.name,
          brandBrain: brain && !isEmptyBrain(brain.data) ? brainToPrompt(brain.data) : undefined,
          authorName: projectCarousel.authorName || brandRecord.name,
          handle: projectCarousel.handle,
          language: ((adv as { language?: string } | undefined)?.language) || undefined,
          ctaGoal,
          slideNotes: Array.isArray(slideNotes) ? slideNotes.filter((n: unknown) => typeof n === "string").slice(0, 6) : undefined,
        });
        // Planning is quick and billed now; the slides render as a background task
        // (round by round) so a long carousel never hits a request timeout.
        try {
          await commit(session.user.id, sAuth, [{ key: "carousel.plan" }], { ref, note: `Carousel plan (${style.name})` });
        } catch (billErr) {
          console.error("[CAROUSEL API] plan billing failed:", billErr);
        }
        const task = await createCarouselTask(session.user.id, {
          brandId: brandRecord.id,
          styleId: style.id,
          styleName: style.name,
          plan,
          refs: chooseRefs(style),
          size: chosenSize,
          colours: { primary: sg?.primaryColor, secondary: sg?.secondaryColor, accent: sg?.accentColor, background: sg?.backgroundColor },
          userImages: images,
          logoUrl: brandRecord.logo || null,
          logoPlacement: logoPlacementFor(brandRecord.logo, (brandRecord.logoPosition as unknown as LogoPosition | null) || undefined, brandRecord.logoScale ?? undefined),
          topic,
        });
        bumpStyleUsage(style.id);
        return NextResponse.json({
          success: true,
          data: {
            background: true,
            taskId: task.id,
            plan: { topic, totalSlides: plan.slides.length, ctaGoal: ctaGoal || "" },
            format: "carousel",
            style: { id: style.id, name: style.name },
            size: chosenSize,
            disclosure: null,
            slides: [],
          },
        });
      }
      // No carousel style published yet: fall through to the classic generator.
    }

    // ---- BILLING: a carousel is never free-trial. Check the full estimate up front
    // (plan + every slide) so we never start one the user can't pay for.
    const billingRef = randomUUID();
    const estSlides = typeof slideCount === "number" && slideCount > 0 ? slideCount : 6;
    let auth;
    try {
      auth = await authorize(session.user.id, [{ key: "carousel.plan" }, { key: "image.openai", qty: estSlides }], { trial: "none" });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) return insufficientResponse(e);
      throw e;
    }

    const brand = brandRecord ?? {
      name: "TikTok slideshow",
      logo: null,
      logoPosition: null,
      logoScale: null,
      styleGuide: null,
    };

    const sg = brand.styleGuide;
    const styleGuide: Partial<StyleGuideData> | null = sg
      ? {
          primaryColor: sg.primaryColor,
          secondaryColor: sg.secondaryColor,
          accentColor: sg.accentColor,
          backgroundColor: sg.backgroundColor ?? undefined,
          headingFont: sg.headingFont,
          tone: sg.tone as unknown as StyleGuideData["tone"],
          extraNotes: sg.extraNotes ?? undefined,
          rawMarkdown: sg.rawMarkdown ?? undefined,
          layoutArchetypes: sg.layoutArchetypes as unknown as LayoutArchetype[] | undefined,
          language: ((sg as unknown as { advancedSettings?: Record<string, unknown> }).advancedSettings?.language as string) || undefined,
          ecommerce: ((sg as unknown as { advancedSettings?: { ecommerce?: StyleGuideData["ecommerce"] } }).advancedSettings?.ecommerce) || undefined,
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
    } else if (Array.isArray((sg as any)?.generationPool) && ((sg as any)?.generationPool as string[]).length > 0) {
  resolvedReferences = (sg as any)!.generationPool as string[];
      console.log("[CAROUSEL API] 📸 Falling back to brand generation pool:", resolvedReferences.length);
    } else if (Array.isArray(sg?.referenceImages) && (sg?.referenceImages as unknown as string[]).length > 0) {
      resolvedReferences = sg!.referenceImages as unknown as string[];
      console.log("[CAROUSEL API] 📸 Falling back to raw reference board:", resolvedReferences.length);
    } else if (isTikTok) {
      // No project: use the shared reference library (exemplar slides).
      const library = await db.inspirationImage.findMany({
        where: { status: "exemplar" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { url: true },
      });
      resolvedReferences = library.map((item) => item.url);
      console.log("[CAROUSEL API] 📚 TikTok reference library:", resolvedReferences.length);
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
      logoPosition: (brand.logoPosition as unknown as LogoPosition | null) || undefined,
      logoScale: brand.logoScale ?? undefined,
      noText: isTikTok, // TikTok slides come back as clean backgrounds; text is added in the editor
    });

    const successCount = slides.filter((s) => s.imageUrl).length;
    console.log("[CAROUSEL API] ✅ Done —", successCount, "/", slides.length, "slides generated");

    // ---- BILLING: charge for the plan + only the slides that actually rendered.
    try {
      await commit(session.user.id, auth, [{ key: "carousel.plan" }, { key: "image.openai", qty: successCount }], { ref: billingRef });
    } catch (billErr) {
      console.error("[CAROUSEL API] ⚠️ billing commit failed (slides still returned):", billErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        plan: { topic: plan.topic, totalSlides: plan.totalSlides, ctaGoal: plan.ctaGoal },
        format: isTikTok ? "tiktok_slideshow" : "carousel",
        disclosure: isTikTok
          ? { brandedContent: !!brandedContent, clientName: clientName || null }
          : null,
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

// Every AI call in this request is measured for real-cost billing.
export const POST = withUsage(handlePOST);
