// ============================================================
// UXLLY Billing — settings (editable in /admin, stored in BillingSetting)
// ============================================================

import { db } from "@/lib/db";

export const DEFAULT_SETTINGS = {
  /** What ONE app credit sells for, in US cents. 10 = $0.10 */
  creditValueCents: 10,
  /** Pay-as-you-go top-up limits (cents) */
  topupMinCents: 500,
  topupMaxCents: 50000,
  topupPresetsCents: [1000, 2500, 5000, 10000] as number[],
  /** Purchased + plan credits expire this many days after they are granted */
  creditExpiryDays: 365,
  /** Free trial: first-day limit, later-day limit, lifetime total (images produced) */
  freeEnabled: true,
  freeDay1: 2,
  freeLaterDay: 1,
  freeTotal: 3,
  /** Auto-reload amount limits (cents) */
  autoReloadMinCents: 500,
  autoReloadMaxCents: 50000,
  currency: "usd",
  /**
   * REAL-COST PRICING. Every AI action charges: what it really cost you ×
   * markup, converted to credits at creditValueCents. Stored as whole numbers:
   * markupPercent 300 = 3×; model prices in US cents per 1M tokens.
   * Edit in /admin → AI prices when a provider changes its prices.
   */
  markupPercent: 300,
  /** OpenAI image model (gpt-image-2): text in / image in / image out */
  imageTextInCentsPerM: 500,
  imageImageInCentsPerM: 800,
  imageOutCentsPerM: 3000,
  /** OpenAI text + vision calls (OPENAI_VISION_MODEL / OPENAI_CHAT_MODEL, default gpt-4o-mini) */
  openaiTextInCentsPerM: 15,
  openaiTextOutCentsPerM: 60,
  /** The main text provider when it isn't OpenAI (AI_TEXT_PROVIDER: deepseek by default) */
  textInCentsPerM: 14,
  textOutCentsPerM: 28,
  /** FLUX via Together, per image, in micro-USD (3000 = $0.003) */
  fluxImageMicroUsd: 3000,
  /** Smallest charge for any action that ran, in milli-credits (300 = 0.3 credit) */
  minChargeMilli: 300,
};

export type BillingSettings = typeof DEFAULT_SETTINGS;

let cache: { at: number; value: BillingSettings } | null = null;

export async function getSettings(): Promise<BillingSettings> {
  if (cache && Date.now() - cache.at < 10_000) return cache.value;
  const rows = await db.billingSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  }
  const value = merged as BillingSettings;
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(patch: Partial<BillingSettings>): Promise<BillingSettings> {
  for (const [key, raw] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const def = (DEFAULT_SETTINGS as Record<string, unknown>)[key];
    let value: unknown = raw;
    if (typeof def === "number") {
      value = Math.round(Number(raw));
      if (!Number.isFinite(value as number) || (value as number) < 0) continue;
    } else if (typeof def === "boolean") {
      value = !!raw;
    } else if (Array.isArray(def)) {
      value = (Array.isArray(raw) ? raw : [])
        .map((n) => Math.round(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0);
    } else if (typeof def === "string") {
      value = String(raw || def).toLowerCase();
    }
    if (key === "creditValueCents" && (value as number) < 1) continue;
    await db.billingSetting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: { value: value as never },
    });
  }
  cache = null;
  return getSettings();
}
