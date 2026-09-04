// ============================================================
// UXLLY — Projects (Brand + Channel) CRUD API
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { persistLogo } from "@/lib/storage";

// ==================== GET: List User's Channels ====================
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brands = await db.brand.findMany({
      where: { userId: session.user.id },
      include: {
        styleGuide: {
          select: {
            id: true,
            primaryColor: true,
            secondaryColor: true,
            accentColor: true,
            backgroundColor: true,
            headingFont: true,
            tone: true,
            extraNotes: true,
            rawMarkdown: false,
            referenceImages: false,
          },
        },
        channels: {
          include: { _count: { select: { posts: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    console.error("Projects GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ==================== DELETE: Remove Brand (cascades everything) ====================
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const brand = await db.brand.findFirst({
      where: { id: brandId, userId: session.user.id },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Cascades to StyleGuide, Channels, Posts, Conversations, Messages, Jobs
    await db.brand.delete({ where: { id: brandId } });

    console.log("[PROJECTS] 🗑️ Deleted brand:", brand.name, `(${brandId})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Projects DELETE error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      brandName, channelName, platform, channelDescription,
      referenceImages, logoBase64, styleNotes,
      primaryColor, secondaryColor, accentColor, backgroundColor, tone, headingFont,
    } = await request.json();

    // Persist the logo separately from style references — it's never
    // sent to the generative pipeline for analysis or editing, only
    // composited on top of finished generations later.
    const logoUrl = logoBase64 ? await persistLogo(logoBase64) : null;

    // Create brand + style guide (no transaction — Supabase too slow for large payloads)
    const brand = await db.brand.create({
      data: {
        userId: session.user.id,
        name: brandName,
        logo: logoUrl,
        styleGuide: {
          create: {
            referenceImages: referenceImages || [],
            extraNotes: styleNotes || null,
            primaryColor: primaryColor || "#1A1A1A",
            secondaryColor: secondaryColor || "#FFFFFF",
            accentColor: accentColor || "#00A8E8",
            backgroundColor: backgroundColor || undefined,
            headingFont: headingFont || "Inter",
            tone: tone || "bold",
          },
        },
      },
    });

    const channel = await db.channel.create({
      data: {
        brandId: brand.id,
        name: channelName,
        platform,
        description: channelDescription || null,
      },
    });

    console.log("[PROJECTS] ✅ Created brand:", brandName,
      "| Channel:", channelName,
      "| References:", (referenceImages || []).length, "images"
    );

    return NextResponse.json({ success: true, data: { brand, channel } });
  } catch (error) {
    console.error("Projects POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}