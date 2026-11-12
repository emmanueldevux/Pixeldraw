// ============================================================
// UXLLY Billing — Stripe client + customer helpers
// Needs: npm i stripe
// Env:   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
//
// We pin the Stripe API version so response shapes can't change under you
// when you bump the SDK. Version-dependent fields are read through `any`.
// ============================================================

import Stripe from "stripe";
import { db } from "@/lib/db";

let client: Stripe | null = null;

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20" as never,
      maxNetworkRetries: 2,
    });
  }
  return client;
}

export async function getOrCreateAccount(userId: string) {
  return db.billingAccount.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function ensureCustomer(userId: string) {
  const account = await getOrCreateAccount(userId);
  if (account.stripeCustomerId) return { customerId: account.stripeCustomerId, account };
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  const customer = await getStripe().customers.create(
    { email: user?.email ?? undefined, name: user?.name ?? undefined, metadata: { userId } },
    { idempotencyKey: `cust:${userId}` }
  );
  const updated = await db.billingAccount.update({
    where: { userId },
    data: { stripeCustomerId: customer.id },
  });
  return { customerId: customer.id, account: updated };
}

/** Friendly message from a Stripe error. */
export function stripeMessage(e: unknown): string {
  const err = e as { message?: string; raw?: { message?: string } };
  return err?.raw?.message || err?.message || "Payment failed";
}
