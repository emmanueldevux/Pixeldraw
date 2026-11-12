// UXLLY — Plan items for the calendar grid. GET ?start=ISO&end=ISO
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const start = sp.get("start"), end = sp.get("end");
  const items = await db.planItem.findMany({
    where: { userId: session.user.id, status: { not: "skipped" }, ...(start && end ? { scheduledAt: { gte: new Date(start), lte: new Date(end) } } : {}) },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });
  return NextResponse.json({ success: true, data: items });
}
