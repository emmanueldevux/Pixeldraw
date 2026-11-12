// ============================================================
// UXLLY — Saved generations
//   GET  ?brandId=&limit=   → latest designs (Files tab)
//   POST { id, action: "download" | "delete" }  → learning signals / hide
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 60));
  const brandId = sp.get("brandId");
  const rows = await db.generation.findMany({
    where: { userId: session.user.id, deleted: false, ...(brandId ? { brandId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, kind: true, title: true, imageUrls: true, caption: true, brandId: true, createdAt: true },
  });
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const where = { id, userId: session.user.id };
  if (body?.action === "download") await db.generation.updateMany({ where, data: { downloads: { increment: 1 } } });
  else if (body?.action === "delete") await db.generation.updateMany({ where, data: { deleted: true } });
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json({ success: true });
}
