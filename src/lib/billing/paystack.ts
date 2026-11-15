// ============================================================
// UXLLY Billing — Paystack client + helpers (no SDK, plain fetch)
// Env:   PAYSTACK_SECRET_KEY            (sk_test_... / sk_live_...)
//        PAYSTACK_CURRENCY              NGN (default) or USD (only if Paystack enabled USD for you)
//        PAYSTACK_NGN_PER_USD           rate used when charging in NGN (default 1500)
//        NEXTAUTH_URL                   used for the return page after checkout
// Prices in the app stay in US dollars. When PAYSTACK_CURRENCY=NGN the amount is
// converted at the rate above at the moment of checkout.
// ============================================================
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

const API = "https://api.paystack.co";

export const paystackConfigured = () => !!process.env.PAYSTACK_SECRET_KEY;

export const payCurrency = () => (process.env.PAYSTACK_CURRENCY || "NGN").toUpperCase();
export const ngnPerUsd = () => Number(process.env.PAYSTACK_NGN_PER_USD) || 1500;

/** USD cents -> the smallest unit of the charge currency (kobo / cents). */
export function toSubunit(cents: number): number {
  return payCurrency() === "USD" ? Math.round(cents) : Math.round(cents * ngnPerUsd());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function ps<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  const res = await fetch(`${API}${path}`, {
    method: init?.method || "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === false) throw new Error(json?.message || `Paystack error (${res.status})`);
  return json.data as T;
}

export function verifyWebhookSignature(raw: string, signature: string): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const expected = createHmac("sha512", key).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getOrCreateAccount(userId: string) {
  return db.billingAccount.upsert({ where: { userId }, create: { userId }, update: {} });
}

export function paystackMessage(e: unknown): string {
  return (e as Error)?.message || "Payment failed";
}

// ---- tiny key/value store on the existing BillingSetting table (no migration needed) ----
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await db.billingSetting.findUnique({ where: { key } });
  return (row?.value as T) ?? fallback;
}
export async function kvSet(key: string, value: unknown) {
  await db.billingSetting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } });
}
