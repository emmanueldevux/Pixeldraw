// ============================================================
// UXLLY — Style Guide API
// GET  — load a brand's full project settings (colors, fonts, tone,
//        references, logo placement, and the advanced settings:
//        body font, language, ecommerce block).
// PUT  — save them. Core columns always save; the newer "advancedSettings"
//        JSON is written separately and tolerated if the column isn't
//        there yet (run the Prisma migration to enable language/ecommerce).
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// ==================== GET: load settings ====================
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const brand = await db.brand.findFirst({
      where: { id: brandId, userId: session.user.id },
      include: { styleGuide: true },
    });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const sg = brand.styleGuide;
    // advancedSettings may not exist as a column yet — read defensively.
    const advanced = (sg && (sg as unknown as { advancedSettings?: unknown }).advancedSettings) || {};

    return NextResponse.json({
      success: true,
      data: {
        primaryColor: sg?.primaryColor ?? "#2563EB",
        secondaryColor: sg?.secondaryColor ?? "#1D4ED8",
        accentColor: sg?.accentColor ?? "#22C55E",
        backgroundColor: sg?.backgroundColor ?? null,
        headingFont: sg?.headingFont ?? "Inter",
        tone: sg?.tone ?? "professional",
        extraNotes: sg?.extraNotes ?? "",
        referenceImages: (sg?.referenceImages as unknown as string[]) ?? [],
        advancedSettings: advanced,
        logo: brand.logo ?? null,
        logoPosition: brand.logoPosition ?? null,
        logoScale: brand.logoScale ?? null,
      },
    });
  } catch (error) {
    console.error("Style GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ==================== PUT: save settings ====================
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brandId, advancedSettings, ...styleData } = body;

    // Verify brand belongs to user
    const brand = await db.brand.findFirst({
      where: { id: brandId, userId: session.user.id },
      include: { styleGuide: true },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Build update data — only include fields that were sent
    const updateData: Record<string, unknown> = {};
    if (styleData.primaryColor !== undefined) updateData.primaryColor = styleData.primaryColor;
    if (styleData.secondaryColor !== undefined) updateData.secondaryColor = styleData.secondaryColor;
    if (styleData.accentColor !== undefined) updateData.accentColor = styleData.accentColor;
    if (styleData.backgroundColor !== undefined) updateData.backgroundColor = styleData.backgroundColor || null;
    if (styleData.headingFont !== undefined) updateData.headingFont = styleData.headingFont;
    if (styleData.tone !== undefined) updateData.tone = styleData.tone;
    if (styleData.extraNotes !== undefined) updateData.extraNotes = styleData.extraNotes;
    if (styleData.referenceImages !== undefined) updateData.referenceImages = styleData.referenceImages;

    let styleGuideId: string;

    if (brand.styleGuide) {
      await db.styleGuide.update({ where: { id: brand.styleGuide.id }, data: updateData });
      styleGuideId = brand.styleGuide.id;
    } else {
      const created = await db.styleGuide.create({
        data: {
          brandId,
          primaryColor: styleData.primaryColor || "#2563EB",
          secondaryColor: styleData.secondaryColor || "#1D4ED8",
          accentColor: styleData.accentColor || "#22C55E",
          backgroundColor: styleData.backgroundColor || null,
          headingFont: styleData.headingFont || "Inter",
          tone: styleData.tone || "professional",
          extraNotes: styleData.extraNotes || null,
          referenceImages: styleData.referenceImages || [],
        },
      });
      styleGuideId = created.id;
    }

    // Advanced settings (body font, language, ecommerce) live in a JSON column
    // added later. Write it on its own so a missing column never blocks the
    // core save — until the migration is run, this just no-ops with a warning.
    let advancedSaved = true;
    if (advancedSettings !== undefined) {
      try {
        await db.styleGuide.update({
          where: { id: styleGuideId },
          data: { advancedSettings } as unknown as Record<string, unknown>,
        });
      } catch (err) {
        advancedSaved = false;
        console.warn("[STYLE] advancedSettings not saved (run the Prisma migration to add the column):", (err as Error).message);
      }
    }

    console.log("[STYLE] ✅ Updated style for brand:", brand.name,
      "| References:", (styleData.referenceImages || []).length,
      "| advancedSaved:", advancedSaved
    );

    return NextResponse.json({ success: true, advancedSaved });
  } catch (error) {
    console.error("Style update error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
