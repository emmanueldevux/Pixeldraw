// UXLLY — Content plans
//   GET   → the user's plans (newest first)
//   POST  → draft a plan (wizard or chat command). Free apart from the text drafting.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPlanDraft } from "@/lib/plan/service";
import { withUsage } from "@/lib/billing/usage";
import { InsufficientCreditsError } from "@/lib/billing/meter";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plans = await db.contentPlan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ success: true, data: plans });
}

async function handlePOST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.brandId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.startDate || "")) {
    return NextResponse.json({ error: "Pick a project and a start date" }, { status: 400 });
  }
  try {
    const { plan, trimmed } = await createPlanDraft({
      userId: session.user.id,
      brandId: b.brandId,
      startDate: b.startDate,
      days: Number(b.days) || 30,
      platforms: Array.isArray(b.platforms) ? b.platforms.filter((x: unknown) => typeof x === "string").slice(0, 6) : [],
      postsPerDay: typeof b.postsPerDay === "string" ? b.postsPerDay : "1",
      goals: Array.isArray(b.goals) ? b.goals.filter((x: unknown) => typeof x === "string").slice(0, 6) : [],
      brief: typeof b.brief === "string" ? b.brief.slice(0, 1500) : undefined,
      timezone: typeof b.timezone === "string" ? b.timezone : undefined,
      carouselShare: typeof b.carouselShare === "number" ? b.carouselShare : undefined,
    });
    return NextResponse.json({ success: true, data: plan, trimmed });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: "Not enough credits to draft a plan", code: "insufficient_credits", neededMilli: e.neededMilli }, { status: 402 });
    console.error("[PLANS] create failed:", e);
    return NextResponse.json({ error: (e as Error).message || "Could not draft the plan" }, { status: 500 });
  }
}
export const POST = withUsage(handlePOST);
