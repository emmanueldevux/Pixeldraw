// ============================================================
// UXLLY — same-origin image proxy for our own storage
// The slide editor draws images on a canvas to export them. A canvas only
// exports when the image is same-origin (or the bucket sends CORS headers),
// so slides are served through here. Only our R2 public URL is allowed.
// ============================================================
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const u = new URL(request.url).searchParams.get("u") || "";
  const base = process.env.R2_PUBLIC_URL || "";
  if (!base || !u.startsWith(base)) return NextResponse.json({ error: "Not allowed" }, { status: 400 });
  const r = await fetch(u);
  if (!r.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
