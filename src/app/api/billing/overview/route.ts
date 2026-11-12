// GET /api/billing/overview — everything the billing UI needs in one call.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, unauthorized, isAdminEmail } from "@/lib/billing/http";
import { getBalance } from "@/lib/billing/ledger";
import { getSettings } from "@/lib/billing/settings";
import { getPlans, getRules } from "@/lib/billing/pricing";
import { typicalCharges } from "@/lib/billing/metered";
import { freeTrialStatus } from "@/lib/billing/free";
import { getOrCreateAccount, stripeConfigured } from "@/lib/billing/stripe";
import { listCards } from "@/lib/billing/flows";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const [settings, plans, rules, account, bal, free] = await Promise.all([
    getSettings(),
    getPlans(true),
    getRules(),
    getOrCreateAccount(user.id),
    getBalance(user.id),
    freeTrialStatus(user.id),
  ]);

  let cards: Awaited<ReturnType<typeof listCards>> = [];
  if (stripeConfigured()) {
    try {
      cards = await listCards(user.id);
    } catch (e) {
      console.error("[BILLING] listCards failed:", e);
    }
  }

  const expiries = bal.lots.map((l) => l.expiresAt).filter((x): x is number => x !== null);
  const nextExpiry = expiries.length ? new Date(Math.min(...expiries)).toISOString() : null;
  const plan = account.planKey ? plans.find((p) => p.key === account.planKey) || (await db.billingPlan.findUnique({ where: { key: account.planKey } })) : null;

  return NextResponse.json({
    stripeReady: stripeConfigured() && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    balanceMilli: bal.balanceMilli,
    nextExpiry,
    settings: {
      creditValueCents: settings.creditValueCents,
      topupMinCents: settings.topupMinCents,
      topupMaxCents: settings.topupMaxCents,
      topupPresetsCents: settings.topupPresetsCents,
      creditExpiryDays: settings.creditExpiryDays,
      autoReloadMinCents: settings.autoReloadMinCents,
      autoReloadMaxCents: settings.autoReloadMaxCents,
    },
    plan: plan
      ? {
          key: plan.key,
          name: plan.name,
          priceCents: plan.priceCents,
          creditsMilli: plan.creditsMilli,
          status: account.planStatus,
          currentPeriodEnd: account.currentPeriodEnd,
          cancelAtPeriodEnd: account.cancelAtPeriodEnd,
        }
      : null,
    autoReload: {
      enabled: account.autoReloadEnabled,
      belowMilli: account.autoReloadBelowMilli,
      amountCents: account.autoReloadAmountCents,
    },
    cards,
    free,
    plans: plans.map((p) => ({ key: p.key, name: p.name, priceCents: p.priceCents, creditsMilli: p.creditsMilli })),
    // Real-cost pricing: typical charge per action (actual charges are measured per run).
    pricing: typicalCharges(settings),
    isAdmin: isAdminEmail(user.email),
  });
}
