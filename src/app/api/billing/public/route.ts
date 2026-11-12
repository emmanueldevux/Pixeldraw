// GET /api/billing/public — plans and prices for the pricing page.
// No sign-in needed: nothing here is personal.
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/billing/settings";
import { getPlans } from "@/lib/billing/pricing";
import { typicalCharges } from "@/lib/billing/metered";

export const dynamic = "force-dynamic";

export async function GET() {
  const [settings, plans] = await Promise.all([getSettings(), getPlans(true)]);
  return NextResponse.json({
    stripeReady: false,
    publishableKey: null,
    balanceMilli: 0,
    nextExpiry: null,
    settings: {
      creditValueCents: settings.creditValueCents,
      topupMinCents: settings.topupMinCents,
      topupMaxCents: settings.topupMaxCents,
      topupPresetsCents: settings.topupPresetsCents,
      creditExpiryDays: settings.creditExpiryDays,
      autoReloadMinCents: settings.autoReloadMinCents,
      autoReloadMaxCents: settings.autoReloadMaxCents,
    },
    plan: null,
    autoReload: { enabled: false, belowMilli: 0, amountCents: 0 },
    cards: [],
    free: { enabled: false, available: false, usedTotal: 0, cap: 0, usedToday: 0, todayLimit: 0, firstDay: false },
    plans: plans.map((p) => ({ key: p.key, name: p.name, priceCents: p.priceCents, creditsMilli: p.creditsMilli })),
    pricing: typicalCharges(settings),
    isAdmin: false,
  });
}
