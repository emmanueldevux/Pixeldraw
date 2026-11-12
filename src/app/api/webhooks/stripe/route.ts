// ============================================================
// POST /api/webhooks/stripe — the money-in trust boundary.
// Four rules (ported from the CrawlGecko service, each is a real failure mode):
//   1. Verify the signature against the RAW body (req.text(), never req.json()).
//   2. Only act on the events we expect; acknowledge the rest.
//   3. Idempotent: StripeEventLog + the ledger's (userId, ref) unique index.
//   4. Read user/amount from metadata WE set server-side, never from the client.
// In Stripe dashboard → Developers → Webhooks, send these events:
//   payment_intent.succeeded, invoice.paid, invoice.payment_failed,
//   customer.subscription.updated, customer.subscription.deleted, setup_intent.succeeded
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/billing/stripe";
import {
  grantFromPaymentIntent,
  grantFromInvoice,
  syncSubscription,
  attachSetupIntent,
} from "@/lib/billing/flows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature") || "";

  let event: any;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Already processed? (Stripe redelivers.)
  try {
    await db.stripeEventLog.create({ data: { id: event.id, type: event.type } });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ received: true, duplicate: true });
    throw e;
  }

  try {
    const obj = event.data?.object;
    switch (event.type) {
      case "payment_intent.succeeded":
        await grantFromPaymentIntent(obj);
        break;
      case "invoice.paid":
        await grantFromInvoice(obj.id);
        break;
      case "invoice.payment_failed": {
        const subId = obj.subscription || obj.parent?.subscription_details?.subscription;
        if (subId) await syncSubscription(typeof subId === "string" ? subId : subId.id);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(obj.id);
        break;
      case "setup_intent.succeeded":
        if (obj.metadata?.userId) await attachSetupIntent(obj.metadata.userId, obj.id);
        break;
      default:
        break; // acknowledged, ignored
    }
  } catch (e) {
    // Let Stripe retry: forget we saw this event so the retry is processed.
    await db.stripeEventLog.delete({ where: { id: event.id } }).catch(() => {});
    console.error("[STRIPE WEBHOOK] handler failed:", event.type, e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
