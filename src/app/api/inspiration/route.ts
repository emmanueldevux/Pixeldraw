// ============================================================
// UXLLY — Inspiration Library API
// GET: list inspiration images (optionally filtered)
// POST: add a new one manually (URL for now — swipe/upload tool later)
// DELETE: remove one by id
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// ==================== GET — List ====================

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") || undefined;
  const style = searchParams.get("style") || undefined;
  const mood = searchParams.get("mood") || undefined;

  const images = await db.inspirationImage.findMany({
    where: {
      ...(platform ? { platform } : {}),
      ...(style ? { style } : {}),
      ...(mood ? { mood } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data: images });
}

// ==================== POST — Add ====================

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, platform, style, mood, industry, tags } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "An image URL is required" },
        { status: 400 }
      );
    }

    const image = await db.inspirationImage.create({
      data: {
        url,
        platform: platform || null,
        style: style || null,
        mood: mood || null,
        industry: industry || null,
        tags: Array.isArray(tags) ? tags : [],
        addedBy: session.user.id,
      },
    });

    return NextResponse.json({ success: true, data: image });
  } catch (err) {
    console.error("[INSPIRATION API] Failed to add image:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add inspiration image" },
      { status: 500 }
    );
  }
}

// ==================== DELETE — Remove ====================

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "id is required" },
      { status: 400 }
    );
  }

  await db.inspirationImage.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
