// Shared client types for the billing UI (mirrors /api/billing/overview).
export interface BillingCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface BillingOverview {
  stripeReady: boolean;
  publishableKey: string | null;
  balanceMilli: number;
  nextExpiry: string | null;
  settings: {
    creditValueCents: number;
    topupMinCents: number;
    topupMaxCents: number;
    topupPresetsCents: number[];
    creditExpiryDays: number;
    autoReloadMinCents: number;
    autoReloadMaxCents: number;
  };
  plan: null | {
    key: string;
    name: string;
    priceCents: number;
    creditsMilli: number;
    status: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  autoReload: { enabled: boolean; belowMilli: number; amountCents: number };
  cards: BillingCard[];
  free: {
    enabled: boolean;
    available: boolean;
    usedTotal: number;
    cap: number;
    usedToday: number;
    todayLimit: number;
    firstDay: boolean;
  };
  plans: { key: string; name: string; priceCents: number; creditsMilli: number }[];
  pricing: { key: string; label: string; creditsMilli: number }[];
  isAdmin: boolean;
}

export interface TopUpOptions {
  /** why the popup opened — shows a friendly banner */
  reason?: "out_of_credits";
  neededMilli?: number;
  /** prefill the amount field (e.g. from the Custom plan card) */
  amountCents?: number;
}
