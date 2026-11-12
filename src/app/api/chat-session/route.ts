// UXLLY — Saved AI chat per project
//   GET    ?brandId=  → the saved messages
//   PUT    { brandId, messages }  → save (images are R2 URLs; raw image data is never stored)
//   DELETE ?brandId=  → "New chat"
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const MAX = 80;

async function uid() {
  return (await getServerSession(authOptions))?.user?.id ?? null;
}
const isRaw = (u: unknown) => typeof u === "string" && u.startsWith("data:");

export async function GET(request: Request) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brandId = new URL(request.url).searchParams.get("brandId") || "";
  const row = await db.chatSession.findUnique({ where: { userId_brandId: { userId, brandId } } });
  return NextResponse.json({ success: true, data: row ? row.messages : [] });
}

export async function PUT(request: Request) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.brandId !== "string" || !Array.isArray(b.messages)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const brand = await db.brand.findFirst({ where: { id: b.brandId, userId }, select: { id: true } });
  if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = b.messages
    .filter((m: { isLoading?: boolean }) => !m?.isLoading)
    .slice(-MAX)
    .map((m: Record<string, unknown>) => ({
      id: m.id, role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 8000) : "",
      imageUrl: isRaw(m.imageUrl) ? null : m.imageUrl ?? null,
      logo: m.logo ?? null,
      generationId: m.generationId ?? null,
      carouselSlides: Array.isArray(m.carouselSlides) ? (m.carouselSlides as { imageUrl?: string }[]).map((s) => ({ ...s, imageUrl: isRaw(s.imageUrl) ? "" : s.imageUrl })) : null,
      createdAt: m.createdAt,
    }));
  await db.chatSession.upsert({
    where: { userId_brandId: { userId, brandId: b.brandId } },
    create: { userId, brandId: b.brandId, messages: messages as never },
    update: { messages: messages as never },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brandId = new URL(request.url).searchParams.get("brandId") || "";
  await db.chatSession.deleteMany({ where: { userId, brandId } });
  return NextResponse.json({ success: true });
}
