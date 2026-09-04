// ============================================================
// UXLLY — Style Guide Update API
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brandId, ...styleData } = body;

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

    let styleGuide;

    if (brand.styleGuide) {
      // Update existing
      styleGuide = await db.styleGuide.update({
        where: { id: brand.styleGuide.id },
        data: updateData,
      });
    } else {
      // Create new
      styleGuide = await db.styleGuide.create({
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
    }

    console.log("[STYLE] ✅ Updated style for brand:", brand.name,
      "| References:", (styleData.referenceImages || []).length
    );

    return NextResponse.json({ success: true, data: styleGuide });
  } catch (error) {
    console.error("Style update error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}