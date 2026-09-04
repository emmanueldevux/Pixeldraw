// ============================================================
// UXLLY — Jobs CRUD API
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobs = await db.job.findMany({
      where: { userId: session.user.id },
      include: { channel: { include: { brand: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    console.error("Jobs GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const job = await db.job.create({
      data: {
        userId: session.user.id,
        channelId: body.channelId,
        name: body.name,
        prompt: body.prompt,
        schedule: body.schedule,
        platform: body.platform,
        size: body.size || "1080x1080",
        deliveryEmail: body.deliveryEmail ?? true,
        deliveryTelegram: body.deliveryTelegram ?? false,
        deliverySocial: body.deliverySocial ?? false,
        telegramChatId: body.telegramChatId || null,
      },
    });

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    console.error("Jobs POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
