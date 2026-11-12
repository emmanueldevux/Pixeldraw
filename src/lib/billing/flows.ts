// ============================================================
// UXLLY Billing — Stripe money flows
//
// MONEY IN has exactly one door per kind, and every door is idempotent:
//   top-up / auto-reload  -> grantFromPaymentIntent()  ref "pi:<id>"
//   subscription cycles   -> grantFromInvoice()        ref "inv:<id>"
// Both are called from the webhook AND from the client "sync" call right
// after a payment, so local dev works without the Stripe CLI and a slow
// webhook never leaves a paying customer waiting. The (userId, ref) unique
// index guarantees whichever arrives second does nothing.
//
// Prices come from OUR database (never the browser): amount limits and the
// credits-per-dollar rate are read server-side on every request.
// ============================================================

import { db } from "@/lib/db";
import { getStripe, ensureCustomer, getOrCreateAccount, stripeMessage } from "./stripe";
import { getSettings } from "./settings";
import { getPlans } from "./pricing";
import { grantCredits, getBalanceMilli, writeNote } from "./ledger";
import { centsToMilli, usd, formatCredits } from "./units";

// Stripe objects are read through `any`: some field names differ between API versions.
/* eslint-disable @typescript-eslint/no-explicit-any */

// ------------------------------------------------------------------
// Top-up (pay as you go) and auto-reload
// ------------------------------------------------------------------
export async function createTopUp(opts: {
  userId: string;
  amountCents: number;
  paymentMethodId?: string;
  idempotencyKey?: string;
  kind?: "topup" | "autoreload";
}) {
  const kind = opts.kind ?? "topup";
  const settings = await getSettings();
  const min = kind === "autoreload" ? settings.autoReloadMinCents : settings.topupMinCents;
  const max = kind === "autoreload" ? settings.autoReloadMaxCents : settings.topupMaxCents;
  const amountCents = Math.round(opts.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < min || amountCents > max) {
    throw new Error(`Amount must be between ${usd(min)} and ${usd(max)}`);
  }

  const { customerId, account } = await ensureCustomer(opts.userId);
  const pm = opts.paymentMethodId || account.defaultPaymentMethod;
  if (!pm) throw new Error("Add a payment method first");

  const creditsMilli = centsToMilli(amountCents, settings.creditValueCents);
  const stripe = getStripe();
  const params: any = {
    amount: amountCents,
    currency: settings.currency,
    customer: customerId,
    payment_method: pm,
    confirm: true,
    description: `${formatCredits(creditsMilli)} UXLLY credits`,
    metadata: {
      userId: opts.userId,
      type: kind,
      creditsMilli: String(creditsMilli),
      amountCents: String(amountCents),
    },
  };
  if (kind === "autoreload") params.off_session = true;
  else params.automatic_payment_methods = { enabled: true, allow_redirects: "never" };

  let pi: any;
  try {
    pi = await stripe.paymentIntents.create(params, opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined);
  } catch (e) {
    throw new Error(stripeMessage(e));
  }

  if (pi.status === "succeeded") {
    await grantFromPaymentIntent(pi);
    return { status: "succeeded" as const, paymentIntentId: pi.id as string, creditsMilli };
  }
  if (pi.status === "requires_action") {
    return { status: "requires_action" as const, paymentIntentId: pi.id as string, clientSecret: pi.client_secret as string, creditsMilli };
  }
  throw new Error("Payment could not be completed");
}

export async function grantFromPaymentIntent(pi: any) {
  const meta = pi?.metadata || {};
  if (!meta.userId || (meta.type !== "topup" && meta.type !== "autoreload")) return null;
  if (pi.status !== "succeeded") return null;
  const creditsMilli = Number(meta.creditsMilli);
  const amountCents = Number(meta.amountCents);
  if (!creditsMilli || !amountCents) return null;
  if (pi.amount_received != null && Number(pi.amount_received) !== amountCents) {
    console.error("[BILLING] amount mismatch on", pi.id, pi.amount_received, amountCents);
    return null;
  }
  return grantCredits({
    userId: meta.userId,
    amountMilli: creditsMilli,
    kind: meta.type === "autoreload" ? "autoreload" : "purchase",
    ref: `pi:${pi.id}`,
    note: `${meta.type === "autoreload" ? "Auto-reload" : "Credit purchase"} — ${usd(amountCents)}`,
    meta: { paymentIntent: pi.id, amountCents },
  });
}

/** Pull a PaymentIntent from Stripe and grant if it succeeded (used after the client confirms 3-D Secure). */
export async function syncPaymentIntent(paymentIntentId: string, userId: string) {
  const pi: any = await getStripe().paymentIntents.retrieve(paymentIntentId);
  if (pi.metadata?.userId !== userId) throw new Error("Not your payment");
  await grantFromPaymentIntent(pi);
  return pi.status as string;
}

export async function maybeAutoReload(userId: string) {
  const account = await db.billingAccount.findUnique({ where: { userId } });
  if (!account?.autoReloadEnabled || !account.defaultPaymentMethod || !process.env.STRIPE_SECRET_KEY) return;
  const balance = await getBalanceMilli(userId);
  if (balance >= account.autoReloadBelowMilli) return;
  // One attempt per 10-minute window, no matter how many generations finish at once.
  const windowKey = Math.floor(Date.now() / 600_000);
  try {
    await createTopUp({
      userId,
      amountCents: account.autoReloadAmountCents,
      kind: "autoreload",
      idempotencyKey: `ar:${userId}:${windowKey}`,
    });
  } catch (e) {
    await db.billingAccount.update({ where: { userId }, data: { autoReloadEnabled: false } });
    await writeNote(userId, `Auto-reload turned off — payment failed: ${(e as Error).message}`, `arfail:${userId}:${windowKey}`);
  }
}

// ------------------------------------------------------------------
// Subscriptions
// ------------------------------------------------------------------
export async function subscribe(userId: string, planKey: string) {
  const plans = await getPlans(true);
  const plan = plans.find((p) => p.key === planKey);
  if (!plan) throw new Error("Plan not found");

  const { customerId, account } = await ensureCustomer(userId);
  if (account.stripeSubscriptionId && account.planStatus && ["active", "trialing", "past_due"].includes(account.planStatus)) {
    throw new Error("You already have a plan. Cancel it first to switch.");
  }
  if (!account.defaultPaymentMethod) throw new Error("Add a payment method first");

  const stripe = getStripe();
  const settings = await getSettings();

  let productId = plan.stripeProductId;
  if (!productId) {
    const product = await stripe.products.create({ name: `UXLLY ${plan.name}`, metadata: { planKey: plan.key } });
    productId = product.id;
    await db.billingPlan.update({ where: { id: plan.id }, data: { stripeProductId: productId } });
  }

  let sub: any;
  try {
    sub = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [
          {
            price_data: {
              currency: settings.currency,
              product: productId,
              unit_amount: plan.priceCents,
              recurring: { interval: "month" },
            },
          },
        ],
        default_payment_method: account.defaultPaymentMethod,
        payment_behavior: "allow_incomplete",
        metadata: { userId, planKey: plan.key },
        expand: ["latest_invoice.payment_intent"],
      } as any,
      { idempotencyKey: `sub:${userId}:${plan.key}:${Math.floor(Date.now() / 60_000)}` }
    );
  } catch (e) {
    throw new Error(stripeMessage(e));
  }

  await db.billingAccount.update({
    where: { userId },
    data: {
      stripeSubscriptionId: sub.id,
      planKey: plan.key,
      planStatus: sub.status,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    },
  });

  const invoice = sub.latest_invoice;
  const pi = invoice?.payment_intent;
  if (sub.status === "active") {
    if (invoice?.id) await grantFromInvoice(invoice.id);
    return { status: "active" as const };
  }
  if (pi?.status === "requires_action") {
    return { status: "requires_action" as const, clientSecret: pi.client_secret as string, subscriptionId: sub.id as string };
  }
  // Declined — don't leave a dangling incomplete subscription.
  try {
    await stripe.subscriptions.cancel(sub.id);
  } catch {
    /* ignore */
  }
  await db.billingAccount.update({
    where: { userId },
    data: { stripeSubscriptionId: null, planKey: null, planStatus: null, currentPeriodEnd: null },
  });
  throw new Error("Your card was declined");
}

export async function grantFromInvoice(invoiceId: string) {
  const stripe = getStripe();
  const invoice: any = await stripe.invoices.retrieve(invoiceId);
  if (invoice.status !== "paid") return null;
  // Credits only on a new subscription or a renewal (not on proration updates).
  if (!["subscription_create", "subscription_cycle"].includes(invoice.billing_reason)) return null;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null; // (an undefined filter would match the FIRST account — never allow that)
  const account = await db.billingAccount.findFirst({ where: { stripeCustomerId: customerId } });
  if (!account) return null;

  const plans = await getPlans(false);
  const plan =
    plans.find((p) => p.key === account.planKey) ||
    plans.find((p) => p.priceCents === invoice.amount_paid);
  if (!plan) return null;

  return grantCredits({
    userId: account.userId,
    amountMilli: plan.creditsMilli,
    kind: "plan",
    ref: `inv:${invoice.id}`,
    note: `${plan.name} plan — monthly credits`,
    meta: { invoice: invoice.id, plan: plan.key },
  });
}

export async function syncSubscription(subscriptionId: string) {
  const sub: any = await getStripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;
  const account = await db.billingAccount.findFirst({ where: { stripeCustomerId: customerId } });
  if (!account) return;

  const ended = sub.status === "canceled" || sub.status === "incomplete_expired";
  await db.billingAccount.update({
    where: { id: account.id },
    data: ended
      ? { stripeSubscriptionId: null, planKey: null, planStatus: "canceled", cancelAtPeriodEnd: false }
      : {
          stripeSubscriptionId: sub.id,
          planKey: sub.metadata?.planKey || account.planKey,
          planStatus: sub.status,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        },
  });
  if (sub.latest_invoice) {
    const id = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice.id;
    if (id && !ended) await grantFromInvoice(id);
  }
}

export async function setCancelAtPeriodEnd(userId: string, cancel: boolean) {
  const account = await getOrCreateAccount(userId);
  if (!account.stripeSubscriptionId) throw new Error("No active plan");
  await getStripe().subscriptions.update(account.stripeSubscriptionId, { cancel_at_period_end: cancel });
  await db.billingAccount.update({ where: { userId }, data: { cancelAtPeriodEnd: cancel } });
}

// ------------------------------------------------------------------
// Cards
// ------------------------------------------------------------------
export async function attachSetupIntent(userId: string, setupIntentId: string) {
  const stripe = getStripe();
  const si: any = await stripe.setupIntents.retrieve(setupIntentId);
  const { customerId, account } = await ensureCustomer(userId);
  if (si.customer !== customerId) throw new Error("Not your card");
  if (si.status !== "succeeded" || !si.payment_method) throw new Error("Card was not saved");
  const pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method.id;
  if (!account.defaultPaymentMethod) await setDefaultPaymentMethod(userId, pmId);
  return pmId as string;
}

export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
  const { customerId } = await ensureCustomer(userId);
  const stripe = getStripe();
  const pm: any = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== customerId) throw new Error("Not your card");
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
  await db.billingAccount.update({ where: { userId }, data: { defaultPaymentMethod: paymentMethodId } });
}

export async function listCards(userId: string) {
  const account = await getOrCreateAccount(userId);
  if (!account.stripeCustomerId) return [];
  const list = await getStripe().paymentMethods.list({ customer: account.stripeCustomerId, type: "card" });
  return list.data.map((pm: any) => ({
    id: pm.id as string,
    brand: pm.card?.brand as string,
    last4: pm.card?.last4 as string,
    expMonth: pm.card?.exp_month as number,
    expYear: pm.card?.exp_year as number,
    isDefault: pm.id === account.defaultPaymentMethod,
  }));
}

export async function removeCard(userId: string, paymentMethodId: string) {
  const account = await getOrCreateAccount(userId);
  const stripe = getStripe();
  const pm: any = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== account.stripeCustomerId) throw new Error("Not your card");

  const others = (await listCards(userId)).filter((c) => c.id !== paymentMethodId);
  const isDefault = account.defaultPaymentMethod === paymentMethodId;
  const hasPlan = !!account.stripeSubscriptionId;
  if (isDefault && others.length === 0 && hasPlan) {
    throw new Error("Cancel your plan before removing your only card.");
  }

  await stripe.paymentMethods.detach(paymentMethodId);
  if (isDefault) {
    if (others.length > 0) {
      await setDefaultPaymentMethod(userId, others[0].id);
      if (account.stripeSubscriptionId) {
        await stripe.subscriptions.update(account.stripeSubscriptionId, { default_payment_method: others[0].id });
      }
    } else {
      await db.billingAccount.update({
        where: { userId },
        data: { defaultPaymentMethod: null, autoReloadEnabled: false },
      });
    }
  }
}
