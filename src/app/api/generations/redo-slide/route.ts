// ============================================================
// UXLLY — Redo one slide of a saved carousel
// POST { generationId, slideNumber, headline?, body? }
// Re-renders just that slide with the same style, references and brand
// colours (optionally with new words), and swaps it into the carousel.
// Billed for the one image it makes.
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { withUsage } from "@/lib/billing/usage";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { getStyle } from "@/lib/carousels/store";
import { renderStyledSlide, logoPlacementFor, type RefChoice } from "@/lib/carousels/generate";
import type { PlannedSlide } from "@/lib/carousels/planner";
import type { CarouselSize } from "@/lib/carousels/types";
import { persistImage } from "@/lib/generations";
import type { LogoPosition } from "@/lib/ai/logoComposite";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handlePOST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const b = await request.json().catch(() => ({}));
  const gen = await db.generation.findFirst({ where: { id: String(b.generationId || ""), userId, kind: "carousel", deleted: false } });
  const meta = (gen?.meta || null) as { styleId?: string; size?: CarouselSize; refs?: RefChoice; planSlides?: PlannedSlide[] } | null;
  if (!gen || !meta?.styleId || !meta.refs || !Array.isArray(meta.planSlides)) {
    return NextResponse.json({ error: "This carousel can't be redone slide by slide" }, { status: 404 });
  }
  const n = Number(b.slideNumber);
  const planned = meta.planSlides.find((s) => s.slideNumber === n);
  if (!planned) return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  const style = await getStyle(meta.styleId);
  const brand = gen.brandId ? await db.brand.findFirst({ where: { id: gen.brandId, userId }, include: { styleGuide: true } }) : null;
  if (!style || !brand) return NextResponse.json({ error: "The style or project no longer exists" }, { status: 404 });

  let auth;
  try {
    auth = await authorize(userId, [{ key: "image.edit" }], { trial: "none" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: "Not enough credits", code: "insufficient_credits", neededMilli: e.neededMilli }, { status: 402 });
    throw e;
  }

  const slide: PlannedSlide = {
    ...planned,
    title: typeof b.headline === "string" && b.headline.trim() ? b.headline.trim().slice(0, 120) : planned.title,
    body: typeof b.body === "string" ? b.body.slice(0, 400) : planned.body,
  };
  const sg = brand.styleGuide as unknown as Record<string, string | null> | null;
  const size = meta.size || "4:5";
  const urls = [...gen.imageUrls];
  // Keep details pages consistent: anchor on another details page of this carousel.
  const anchorIdx = planned.role === "details" ? meta.planSlides.findIndex((s) => s.role === "details" && s.slideNumber !== n) : -1;
  const anchor = anchorIdx >= 0 ? urls[meta.planSlides[anchorIdx].slideNumber - 1] || undefined : undefined;

  const out = await renderStyledSlide(
    {
      style,
      refs: meta.refs,
      size,
      colours: { primary: sg?.primaryColor, secondary: sg?.secondaryColor, accent: sg?.accentColor, background: sg?.backgroundColor },
      total: meta.planSlides.length,
      logoUrl: brand.logo || null,
      logoPlacement: logoPlacementFor(brand.logo, (brand.logoPosition as unknown as LogoPosition | null) || undefined, brand.logoScale ?? undefined),
    },
    slide,
    anchor,
  );
  if (!out.imageUrl) return NextResponse.json({ error: "Could not redo that slide. Nothing was charged." }, { status: 502 });

  const stored = await persistImage(out.imageUrl, "carousels");
  urls[n - 1] = stored;
  const slides = meta.planSlides.map((s) => (s.slideNumber === n ? slide : s));
  await db.generation.update({ where: { id: gen.id }, data: { imageUrls: urls, redos: { increment: 1 }, meta: { ...meta, planSlides: slides } as never } });
  await commit(userId, auth, [{ key: "image.edit" }], { ref: `redo:${gen.id}:${n}:${Date.now()}`, note: `Redo slide ${n}` }).catch((e) => console.error("[REDO] billing failed:", e));
  return NextResponse.json({ success: true, data: { slideNumber: n, imageUrl: stored, headline: slide.title, body: slide.body } });
}
export const POST = withUsage(handlePOST);
