// UXLLY — save a finished slideshow to Files (the clean photos; text is added in the editor)
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { saveGeneration } from "@/lib/generations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const urls: string[] = Array.isArray(b.imageUrls) ? b.imageUrls.filter((u: unknown): u is string => typeof u === "string" && u.length > 8).slice(0, 12) : [];
  if (!urls.length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  const saved = await saveGeneration({
    userId: user.id,
    brandId: typeof b.brandId === "string" ? b.brandId : null,
    kind: "carousel",
    title: typeof b.title === "string" ? b.title.slice(0, 120) : "TikTok slideshow",
    imageUrls: urls,
    caption: typeof b.caption === "string" ? b.caption : null,
    meta: { slideshow: true, format: b.format ?? null, texts: Array.isArray(b.texts) ? b.texts.slice(0, 12) : [] },
  });
  return NextResponse.json({ success: true, generationId: saved.id });
}
