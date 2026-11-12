// ============================================================
// UXLLY — Write a caption + hashtags for a saved design
// POST { generationId, platform? }  → { caption, hashtags }
// Uses the project's Brand Brain; saved on the design for the Files tab.
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { withUsage } from "@/lib/billing/usage";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { writeCopy } from "@/lib/plan/produce";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handlePOST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const b = await request.json().catch(() => ({}));
  const gen = await db.generation.findFirst({ where: { id: String(b.generationId || ""), userId, deleted: false } });
  if (!gen?.brandId) return NextResponse.json({ error: "Design not found" }, { status: 404 });
  const brand = await db.brand.findFirst({ where: { id: gen.brandId, userId }, include: { styleGuide: true } });
  if (!brand) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let auth;
  try {
    auth = await authorize(userId, [{ key: "chat.text" }], { trial: "none" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: "Not enough credits", code: "insufficient_credits", neededMilli: e.neededMilli }, { status: 402 });
    throw e;
  }
  const meta = (gen.meta || {}) as { planSlides?: { slideNumber: number; title: string }[] };
  const copy = await writeCopy({
    brand: brand as never,
    platform: typeof b.platform === "string" ? b.platform : "instagram",
    topic: gen.title || gen.prompt || "A post for this brand",
    kind: gen.kind === "carousel" ? "carousel" : "single",
    slidesSummary: meta.planSlides?.map((s) => `${s.slideNumber}. ${s.title}`).join(" | "),
  });
  await db.generation.update({ where: { id: gen.id }, data: { caption: [copy.caption, copy.hashtags.join(" ")].filter(Boolean).join("\n\n") } });
  await commit(userId, auth, [{ key: "chat.text" }], { ref: `caption:${gen.id}:${Date.now()}`, note: "Caption + hashtags" }).catch(() => {});
  return NextResponse.json({ success: true, data: { caption: copy.caption, hashtags: copy.hashtags } });
}
export const POST = withUsage(handlePOST);
