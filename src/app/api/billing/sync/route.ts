// POST /api/billing/sync {paymentIntentId?|subscriptionId?}
// Called by the browser right after a payment/3-D Secure so credits show up
// immediately even if the webhook is slow (or you're testing locally without
// the Stripe CLI). Idempotent — the webhook and this call can never double-grant.
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { stripeConfigured, getOrCreateAccount } from "@/lib/billing/stripe";
import { syncPaymentIntent, syncSubscription } from "@/lib/billing/flows";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!stripeConfigured()) return NextResponse.json({ ok: true });
  try {
    const body = await request.json();
    if (body.paymentIntentId) await syncPaymentIntent(String(body.paymentIntentId), user.id);
    const account = await getOrCreateAccount(user.id);
    if (body.subscriptionId && account.stripeSubscriptionId === body.subscriptionId) {
      await syncSubscription(String(body.subscriptionId));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
