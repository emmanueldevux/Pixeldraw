// UXLLY — upload one reference slide to storage (keeps the style request small)
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { persistImage } from "@/lib/generations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.dataUrl !== "string" || !b.dataUrl.startsWith("data:image/") || b.dataUrl.length > 3_000_000) {
    return NextResponse.json({ error: "Send a smaller image" }, { status: 400 });
  }
  return NextResponse.json({ success: true, url: await persistImage(b.dataUrl, "carousel-refs") });
}
