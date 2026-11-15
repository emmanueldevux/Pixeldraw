// ============================================================
// UXLLY Billing — Paystack money flows
//
// MONEY IN has one door, and it is idempotent:
//   grantFromTransaction()  ref "ps:<transaction id>"
// It is called from the webhook (charge.success) AND from the browser "sync"
// call right after Paystack sends the customer back, so a slow webhook never
// leaves a paying customer waiting. The (userId, ref) unique index guarantees
// whichever arrives second does nothing.
//
// Storage (no database change): paystack customer code -> BillingAccount.stripeCustomerId,
// subscription code -> stripeSubscriptionId, default card authorization -> defaultPaymentMethod.
// Saved cards and the subscription email token live in BillingSetting (key "ps:...").
// ============================================================
import { db } from "@/lib/db";
import { ps, toSubunit, payCurrency, getOrCreateAccount, paystackMessage, kvGet, kvSet } from "./paystack";
import { getSettings } from "./settings";
import { getPlans } from "./pricing";
import { grantCredits, getBalanceMilli, writeNote } from "./ledger";
import { centsToMilli, usd, formatCredits } from "./units";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SavedCard {
  id: string; // Paystack authorization_code
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

const cardsKey = (userId: string) => `ps:cards:${userId}`;
const tokenKey = (userId: string) => `ps:subtoken:${userId}`;

async function userEmail(userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!u?.email) throw new Error("Your account needs an email address to pay");
  return u.email;
}

function newRef(kind: string, userId: string) {
  return `uxlly_${kind}_${userId.slice(-6)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function returnUrl(origin?: string) {
  const base = (process.env.NEXTAUTH_URL || origin || "").replace(/\/$/, "");
  return `${base}/billing?ps=1`;
}

// ------------------------------------------------------------------
// Checkout (Paystack hosted page) — used for first payments and plans
// ------------------------------------------------------------------
async function initCheckout(opts: {
  userId: string;
  amountCents: number;
  type: "topup" | "plan";
  creditsMilli: number;
  planKey?: string;
  planCode?: string;
  origin?: string;
}) {
  const email = await userEmail(opts.userId);
  const amount = toSubunit(opts.amountCents);
  const data = await ps<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount,
      currency: payCurrency(),
      reference: newRef(opts.type, opts.userId),
      callback_url: returnUrl(opts.origin),
      ...(opts.planCode ? { plan: opts.planCode } : {}),
      metadata: {
        userId: opts.userId,
        type: opts.type,
        creditsMilli: opts.creditsMilli,
        amountCents: opts.amountCents,
        amountSubunit: amount,
        planKey: opts.planKey || null,
      },
    },
  });
  return { status: "redirect" as const, url: data.authorization_url, reference: data.reference };
}

// ------------------------------------------------------------------
// Top-up (pay as you go) and auto-reload
// ------------------------------------------------------------------
export async function createTopUp(opts: {
  userId: string;
  amountCents: number;
  paymentMethodId?: string; // a saved card (Paystack authorization code)
  kind?: "topup" | "autoreload";
  origin?: string;
}) {
  const kind = opts.kind ?? "topup";
  const settings = await getSettings();
  const min = kind === "autoreload" ? settings.autoReloadMinCents : settings.topupMinCents;
  const max = kind === "autoreload" ? settings.autoReloadMaxCents : settings.topupMaxCents;
  const amountCents = Math.round(opts.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < min || amountCents > max) {
    throw new Error(`Amount must be between ${usd(min)} and ${usd(max)}`);
  }
  const creditsMilli = centsToMilli(amountCents, settings.creditValueCents);

  const account = await getOrCreateAccount(opts.userId);
  const cards = await listCards(opts.userId);
  const card = cards.find((c) => c.id === (opts.paymentMethodId || account.defaultPaymentMethod));

  // No saved card chosen: send them to Paystack checkout (card, bank transfer, USSD…).
  if (!card) {
    if (kind === "autoreload") throw new Error("No saved card");
    return { ...(await initCheckout({ userId: opts.userId, amountCents, type: "topup", creditsMilli, origin: opts.origin })), creditsMilli };
  }

  const email = await userEmail(opts.userId);
  const amount = toSubunit(amountCents);
  let tx: any;
  try {
    tx = await ps("/transaction/charge_authorization", {
      method: "POST",
      body: {
        email,
        amount,
        currency: payCurrency(),
        authorization_code: card.id,
        reference: newRef(kind, opts.userId),
        metadata: { userId: opts.userId, type: kind, creditsMilli, amountCents, amountSubunit: amount },
      },
    });
  } catch (e) {
    throw new Error(paystackMessage(e));
  }
  if (tx.status === "success") {
    await grantFromTransaction(tx);
    return { status: "succeeded" as const, creditsMilli };
  }
  throw new Error(tx.gateway_response || "The card was declined");
}

/** Credits (or a plan's monthly credits) for a successful Paystack transaction. Safe to call twice. */
export async function grantFromTransaction(tx: any) {
  if (!tx || tx.status !== "success") return null;
  const meta = tx.metadata && typeof tx.metadata === "object" ? tx.metadata : {};
  const customerCode: string | undefined = tx.customer?.customer_code;

  // Save the card for next time (card payments only, and only when Paystack says it can be charged again).
  const userIdFromMeta: string | undefined = meta.userId;
  if (userIdFromMeta) await rememberCustomerAndCard(userIdFromMeta, customerCode, tx.authorization);

  // ---- one-off credits ----
  if (meta.userId && (meta.type === "topup" || meta.type === "autoreload")) {
    const creditsMilli = Number(meta.creditsMilli);
    const amountCents = Number(meta.amountCents);
    if (!creditsMilli || !amountCents) return null;
    if (meta.amountSubunit != null && Number(tx.amount) !== Number(meta.amountSubunit)) {
      console.error("[BILLING] amount mismatch on", tx.id, tx.amount, meta.amountSubunit);
      return null;
    }
    return grantCredits({
      userId: meta.userId,
      amountMilli: creditsMilli,
      kind: meta.type === "autoreload" ? "autoreload" : "purchase",
      ref: `ps:${tx.id}`,
      note: `${meta.type === "autoreload" ? "Auto-reload" : "Credit purchase"} — ${usd(amountCents)}`,
      meta: { transaction: tx.id, amountCents },
    });
  }

  // ---- plan: first payment (our metadata) or a monthly renewal (Paystack's plan object) ----
  const plans = await getPlans(false);
  let userId: string | undefined = meta.userId;
  let plan = meta.planKey ? plans.find((p) => p.key === meta.planKey) : undefined;

  if (!userId && customerCode && tx.plan?.plan_code) {
    const account = await db.billingAccount.findFirst({ where: { stripeCustomerId: customerCode } });
    userId = account?.userId;
    if (account?.planKey) plan = plans.find((p) => p.key === account.planKey);
  }
  if (!userId || !plan) return null;
  if (meta.type === "plan" && meta.amountSubunit != null && Number(tx.amount) !== Number(meta.amountSubunit)) {
    console.error("[BILLING] plan amount mismatch on", tx.id);
    return null;
  }

  await db.billingAccount.update({
    where: { userId },
    data: {
      planKey: plan.key,
      planStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(Date.now() + 31 * 86_400_000),
    },
  });
  return grantCredits({
    userId,
    amountMilli: plan.creditsMilli,
    kind: "plan",
    ref: `ps:${tx.id}`,
    note: `${plan.name} plan — monthly credits`,
    meta: { transaction: tx.id, plan: plan.key },
  });
}

async function rememberCustomerAndCard(userId: string, customerCode: string | undefined, auth: any) {
  const account = await getOrCreateAccount(userId);
  const data: Record<string, unknown> = {};
  if (customerCode && account.stripeCustomerId !== customerCode) data.stripeCustomerId = customerCode;

  if (auth?.reusable && auth.authorization_code && (auth.channel === "card" || !auth.channel)) {
    const cards = await kvGet<SavedCard[]>(cardsKey(userId), []);
    // A returning customer paying with the same physical card gets a new code each time: dedupe on last4 + expiry.
    const exists = cards.some((c) => c.last4 === String(auth.last4 || "") && c.expMonth === Number(auth.exp_month) && c.expYear === Number(auth.exp_year));
    if (!exists) {
      cards.push({
        id: auth.authorization_code,
        brand: String(auth.card_type || auth.brand || "card").trim().toLowerCase(),
        last4: String(auth.last4 || ""),
        expMonth: Number(auth.exp_month) || 0,
        expYear: Number(auth.exp_year) || 0,
        isDefault: false,
      });
      await kvSet(cardsKey(userId), cards);
    }
    if (!account.defaultPaymentMethod) data.defaultPaymentMethod = cards[cards.length - 1].id;
  }
  if (Object.keys(data).length) await db.billingAccount.update({ where: { userId }, data: data as never });
}

/** Ask Paystack about a reference and grant if it succeeded (called when the customer returns from checkout). */
export async function verifyReference(reference: string, userId: string) {
  const tx: any = await ps(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.metadata?.userId !== userId) throw new Error("Not your payment");
  await grantFromTransaction(tx);
  if (tx.metadata?.type === "plan") await linkSubscription(userId, tx.customer?.customer_code);
  return tx.status as string;
}

export async function maybeAutoReload(userId: string) {
  const account = await db.billingAccount.findUnique({ where: { userId } });
  if (!account?.autoReloadEnabled || !account.defaultPaymentMethod || !process.env.PAYSTACK_SECRET_KEY) return;
  const balance = await getBalanceMilli(userId);
  if (balance >= account.autoReloadBelowMilli) return;
  // One attempt per 10-minute window, no matter how many generations finish at once.
  const windowKey = Math.floor(Date.now() / 600_000);
  if ((await kvGet<number>(`ps:arwin:${userId}`, -1)) === windowKey) return;
  await kvSet(`ps:arwin:${userId}`, windowKey);
  try {
    await createTopUp({ userId, amountCents: account.autoReloadAmountCents, kind: "autoreload" });
  } catch (e) {
    await db.billingAccount.update({ where: { userId }, data: { autoReloadEnabled: false } });
    await writeNote(userId, `Auto-reload turned off — payment failed: ${(e as Error).message}`, `arfail:${userId}:${windowKey}`);
  }
}

// ------------------------------------------------------------------
// Subscriptions (Paystack plans, monthly)
// ------------------------------------------------------------------
async function ensurePlanCode(plan: { key: string; name: string; priceCents: number }): Promise<string> {
  const amount = toSubunit(plan.priceCents);
  const key = `ps:plan:${plan.key}:${payCurrency()}:${amount}`;
  const cached = await kvGet<string | null>(key, null);
  if (cached) return cached;
  const created = await ps<{ plan_code: string }>("/plan", {
    method: "POST",
    body: { name: `UXLLY ${plan.name} (${payCurrency()} ${amount / 100})`, amount, interval: "monthly", currency: payCurrency() },
  });
  await kvSet(key, created.plan_code);
  return created.plan_code;
}

export async function subscribe(userId: string, planKey: string, origin?: string) {
  const plans = await getPlans(true);
  const plan = plans.find((p) => p.key === planKey);
  if (!plan) throw new Error("Plan not found");
  const account = await getOrCreateAccount(userId);
  if (account.planKey && account.planStatus && ["active", "past_due"].includes(account.planStatus) && !account.cancelAtPeriodEnd) {
    throw new Error("You already have a plan. Cancel it first to switch.");
  }
  const planCode = await ensurePlanCode(plan);
  return initCheckout({ userId, amountCents: plan.priceCents, type: "plan", creditsMilli: plan.creditsMilli, planKey: plan.key, planCode, origin });
}

/** After the first plan payment, find the subscription Paystack created and remember its code + email token. */
export async function linkSubscription(userId: string, customerCode?: string) {
  const account = await getOrCreateAccount(userId);
  const customer = customerCode || account.stripeCustomerId;
  if (!customer) return;
  const subs: any[] = await ps(`/subscription?customer=${encodeURIComponent(customer)}&perPage=10`).catch(() => []);
  const live = subs.find((s) => s.status === "active" || s.status === "non-renewing") || null;
  if (!live) return;
  await kvSet(tokenKey(userId), live.email_token);
  await db.billingAccount.update({
    where: { userId },
    data: {
      stripeSubscriptionId: live.subscription_code,
      currentPeriodEnd: live.next_payment_date ? new Date(live.next_payment_date) : account.currentPeriodEnd,
      cancelAtPeriodEnd: live.status === "non-renewing",
    },
  });
}

export async function setCancelAtPeriodEnd(userId: string, cancel: boolean) {
  const account = await getOrCreateAccount(userId);
  if (!account.stripeSubscriptionId) await linkSubscription(userId);
  const fresh = await getOrCreateAccount(userId);
  const code = fresh.stripeSubscriptionId;
  const token = await kvGet<string | null>(tokenKey(userId), null);
  if (!code || !token) throw new Error("No active plan");
  await ps(cancel ? "/subscription/disable" : "/subscription/enable", { method: "POST", body: { code, token } });
  await db.billingAccount.update({ where: { userId }, data: { cancelAtPeriodEnd: cancel } });
}

/** A cancelled plan stays until the paid period ends; clear it once that date has passed. */
export async function expirePlanIfDue(userId: string) {
  const a = await db.billingAccount.findUnique({ where: { userId } });
  if (!a?.planKey || !a.cancelAtPeriodEnd || !a.currentPeriodEnd || a.currentPeriodEnd.getTime() > Date.now()) return;
  await db.billingAccount.update({ where: { userId }, data: { planKey: null, planStatus: "canceled", cancelAtPeriodEnd: false, stripeSubscriptionId: null } });
}

// ------------------------------------------------------------------
// Cards (saved automatically when a customer pays by card)
// ------------------------------------------------------------------
export async function listCards(userId: string): Promise<SavedCard[]> {
  const account = await getOrCreateAccount(userId);
  const cards = await kvGet<SavedCard[]>(cardsKey(userId), []);
  return cards.map((c) => ({ ...c, isDefault: c.id === account.defaultPaymentMethod }));
}

export async function setDefaultPaymentMethod(userId: string, cardId: string) {
  const cards = await kvGet<SavedCard[]>(cardsKey(userId), []);
  if (!cards.some((c) => c.id === cardId)) throw new Error("Not your card");
  await db.billingAccount.update({ where: { userId }, data: { defaultPaymentMethod: cardId } });
}

export async function removeCard(userId: string, cardId: string) {
  const account = await getOrCreateAccount(userId);
  const cards = await kvGet<SavedCard[]>(cardsKey(userId), []);
  if (!cards.some((c) => c.id === cardId)) throw new Error("Not your card");
  const rest = cards.filter((c) => c.id !== cardId);
  await kvSet(cardsKey(userId), rest);
  if (account.defaultPaymentMethod === cardId) {
    await db.billingAccount.update({
      where: { userId },
      data: rest.length ? { defaultPaymentMethod: rest[0].id } : { defaultPaymentMethod: null, autoReloadEnabled: false },
    });
  }
}

export { formatCredits };
