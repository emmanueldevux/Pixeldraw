// UXLLY — "I've posted it" link from the email. The token is the credential.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (token) {
    const item = await db.planItem.findUnique({ where: { token }, select: { generationId: true, status: true } });
    await db.planItem.updateMany({ where: { token, status: { in: ["sent", "ready"] } }, data: { status: "posted", postedAt: new Date() } });
    // Posting it is the strongest "I liked this" signal for the learning loop.
    if (item?.generationId && ["sent", "ready"].includes(item.status)) {
      await db.generation.updateMany({ where: { id: item.generationId }, data: { downloads: { increment: 2 } } }).catch(() => {});
    }
  }
  return NextResponse.redirect(new URL("/calendar?posted=1", url.origin));
}
