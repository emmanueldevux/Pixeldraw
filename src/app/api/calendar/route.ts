// ============================================================
// UXLLY — Calendar Posts API
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const posts = await db.post.findMany({
      where: {
        channel: { brand: { userId: session.user.id } },
        ...(start && end
          ? {
              scheduledAt: {
                gte: new Date(start),
                lte: new Date(end),
              },
            }
          : {}),
      },
      include: { channel: true },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({ success: true, data: posts });
  } catch (error) {
    console.error("Calendar GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
