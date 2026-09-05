// ============================================================
// UXLLY — Brand Logo Update API
// Updates the logo image, its position, and its scale. The logo
// itself is only ever persisted (and later composited) here —
// it never flows through the generative pipeline.
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { persistLogo } from "@/lib/storage";

const VALID_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right", "top-middle", "bottom-middle", "center"];

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brandId, logoBase64, logoPosition, logoScale } = body;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const brand = await db.brand.findFirst({
      where: { id: brandId, userId: session.user.id },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (logoBase64) {
      updateData.logo = await persistLogo(logoBase64);
    }
    if (logoPosition !== undefined) {
      if (logoPosition === "auto" || logoPosition === null) {
        updateData.logoPosition = null; // null = vary automatically each generation
      } else if (!VALID_POSITIONS.includes(logoPosition)) {
        return NextResponse.json({ error: "Invalid logoPosition" }, { status: 400 });
      } else {
        updateData.logoPosition = logoPosition;
      }
    }
    if (logoScale !== undefined) {
      if (logoScale === null) {
        updateData.logoScale = null; // null = auto-picked per position each generation
      } else {
        const scale = Number(logoScale);
        if (Number.isNaN(scale) || scale <= 0 || scale > 0.6) {
          return NextResponse.json({ error: "logoScale must be between 0 and 0.6" }, { status: 400 });
        }
        updateData.logoScale = scale;
      }
    }

    const updated = await db.brand.update({
      where: { id: brandId },
      data: updateData,
    });

    console.log("[LOGO] ✅ Updated logo settings for brand:", brand.name);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Logo update error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
