// POST /api/billing/setup-intent — starts "Add payment method" (card form in a modal).
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { ensureCustomer, getStripe, stripeConfigured, stripeMessage } from "@/lib/billing/stripe";

export async function POST() {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!stripeConfigured()) return NextResponse.json({ error: "Stripe is not configured yet" }, { status: 503 });
  try {
    const { customerId } = await ensureCustomer(user.id);
    const si = await getStripe().setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session", // lets us charge this card later for auto-reload and renewals
      metadata: { userId: user.id },
    } as never);
    return NextResponse.json({ clientSecret: si.client_secret, setupIntentId: si.id });
  } catch (e) {
    return NextResponse.json({ error: stripeMessage(e) }, { status: 400 });
  }
}
