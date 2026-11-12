// POST /api/billing/topup {amountCents, paymentMethodId?, idempotencyKey?}
// The server validates the amount against admin settings and computes the credits.
// Returns {status:"succeeded"} or {status:"requires_action", clientSecret} (3-D Secure).
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { stripeConfigured } from "@/lib/billing/stripe";
import { createTopUp } from "@/lib/billing/flows";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!stripeConfigured()) return NextResponse.json({ error: "Stripe is not configured yet" }, { status: 503 });
  try {
    const body = await request.json();
    const result = await createTopUp({
      userId: user.id,
      amountCents: Number(body.amountCents),
      paymentMethodId: body.paymentMethodId || undefined,
      idempotencyKey: body.idempotencyKey ? `topup:${user.id}:${String(body.idempotencyKey)}` : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
