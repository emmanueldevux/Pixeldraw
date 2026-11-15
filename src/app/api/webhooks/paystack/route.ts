// ============================================================
// POST /api/webhooks/paystack — the money-in trust boundary.
//   1. Verify x-paystack-signature (HMAC SHA-512 of the RAW body with your secret key).
//   2. Only act on events we expect; acknowledge the rest.
//   3. Idempotent: event log + the ledger's (userId, ref) unique index.
//   4. Read user/amount from metadata WE set server-side, never from the client.
// In Paystack dashboard → Settings → API Keys & Webhooks, set the Webhook URL to
//   https://YOUR-DOMAIN/api/webhooks/paystack
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/billing/paystack";
import { grantFromTransaction, linkSubscription } from "@/lib/billing/flows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function accountFor(customerCode?: string, email?: string) {
  if (customerCode) {
    const a = await db.billingAccount.findFirst({ where: { stripeCustomerId: customerCode } });
    if (a) return a;
  }
  if (email) {
    const u = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (u) return db.billingAccount.findUnique({ where: { userId: u.id } });
  }
  return null;
}

export async function POST(request: Request) {
  if (!process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-paystack-signature") || "")) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const data = event.data || {};
  const eventId = `ps:${event.event}:${data.id ?? data.reference ?? data.subscription_code ?? Date.now()}`;

  try {
    await db.stripeEventLog.create({ data: { id: eventId, type: String(event.event) } });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ received: true, duplicate: true });
    throw e;
  }

  try {
    switch (event.event) {
      case "charge.success": {
        await grantFromTransaction(data);
        const uid = data.metadata?.userId;
        if (uid && data.metadata?.type === "plan") await linkSubscription(uid, data.customer?.customer_code);
        break;
      }
      case "subscription.create": {
        const acc = await accountFor(data.customer?.customer_code, data.customer?.email);
        if (acc) await linkSubscription(acc.userId, data.customer?.customer_code);
        break;
      }
      case "subscription.not_renew":
      case "subscription.disable": {
        const acc = await accountFor(data.customer?.customer_code, data.customer?.email);
        if (acc) await db.billingAccount.update({ where: { id: acc.id }, data: { cancelAtPeriodEnd: true } });
        break;
      }
      case "invoice.payment_failed": {
        const acc = await accountFor(data.customer?.customer_code, data.customer?.email);
        if (acc) await db.billingAccount.update({ where: { id: acc.id }, data: { planStatus: "past_due" } });
        break;
      }
      default:
        break; // acknowledged, ignored
    }
  } catch (e) {
    // Let Paystack retry: forget we saw this event so the retry is processed.
    await db.stripeEventLog.delete({ where: { id: eventId } }).catch(() => {});
    console.error("[PAYSTACK WEBHOOK] handler failed:", event.event, e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
