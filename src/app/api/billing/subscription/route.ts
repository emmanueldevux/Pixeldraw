// POST {planKey} subscribe · DELETE cancel at period end · PATCH resume
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { stripeConfigured } from "@/lib/billing/stripe";
import { subscribe, setCancelAtPeriodEnd } from "@/lib/billing/flows";

function guard() {
  return stripeConfigured() ? null : NextResponse.json({ error: "Stripe is not configured yet" }, { status: 503 });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const g = guard();
  if (g) return g;
  try {
    const { planKey } = await request.json();
    return NextResponse.json(await subscribe(user.id, String(planKey)));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const g = guard();
  if (g) return g;
  try {
    await setCancelAtPeriodEnd(user.id, true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const g = guard();
  if (g) return g;
  try {
    await setCancelAtPeriodEnd(user.id, false);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
