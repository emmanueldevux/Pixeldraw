// UXLLY — store one slideshow image the browser made (a video frame or a merged 2-in-1)
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { persistImage } from "@/lib/generations";
import { viewUrl } from "@/lib/slideshow/view";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const d = typeof b.dataUrl === "string" ? b.dataUrl : "";
  if (!d.startsWith("data:image/") || d.length > 12_000_000) return NextResponse.json({ error: "Send a smaller image" }, { status: 400 });
  const url = await persistImage(d, "slideshow");
  return NextResponse.json({ success: true, url, viewUrl: viewUrl(url) });
}
