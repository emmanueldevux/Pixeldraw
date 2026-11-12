// ============================================================
// UXLLY Billing — pricing rules + plans
// Rules are FIXED credits per action (edited in /admin). Each rule also
// stores an estimate of what the action costs YOU (costMicroUsd, 1e-6 USD)
// so the admin page can show your margin. Defaults below are starting
// guesses — check them against your real provider bills.
// ============================================================

import { db } from "@/lib/db";

export const DEFAULT_RULES = [
  { key: "chat.text",       label: "Chat reply (text model)",             provider: "deepseek / openai", creditsMilli: 200,  costMicroUsd: 2_000 },
  { key: "image.openai",    label: "Image — GPT Image 2",                 provider: "openai",            creditsMilli: 1500, costMicroUsd: 45_000 },
  { key: "image.flux",      label: "Image — FLUX",                        provider: "together",          creditsMilli: 500,  costMicroUsd: 3_000 },
  { key: "image.edit",      label: "Image with product / reference photo", provider: "openai",           creditsMilli: 2000, costMicroUsd: 60_000 },
  { key: "vision.analysis", label: "Brand / reference analysis (vision)", provider: "openai",            creditsMilli: 1000, costMicroUsd: 25_000 },
  { key: "carousel.plan",   label: "Carousel planning (text)",            provider: "deepseek / openai", creditsMilli: 300,  costMicroUsd: 5_000 },
];

export const DEFAULT_PLANS = [
  { key: "starter", name: "Starter", priceCents: 2000, creditsMilli: 200_000, sortOrder: 1 }, // $20 -> 200 credits
  { key: "pro",     name: "Pro",     priceCents: 5000, creditsMilli: 550_000, sortOrder: 2 }, // $50 -> 550 credits (10% bonus)
];

let seeded = false;
/** Seeds default rules/plans the first time (only inserts missing keys — never overwrites your edits). */
export async function ensureDefaults() {
  if (seeded) return;
  const [rules, plans] = await Promise.all([db.pricingRule.findMany({ select: { key: true } }), db.billingPlan.findMany({ select: { key: true } })]);
  const haveR = new Set(rules.map((r) => r.key));
  const haveP = new Set(plans.map((p) => p.key));
  for (const r of DEFAULT_RULES) if (!haveR.has(r.key)) await db.pricingRule.create({ data: r });
  for (const p of DEFAULT_PLANS) if (!haveP.has(p.key)) await db.billingPlan.create({ data: p });
  seeded = true;
}

export async function getRules() {
  await ensureDefaults();
  return db.pricingRule.findMany({ orderBy: { key: "asc" } });
}

export async function getPlans(onlyActive = true) {
  await ensureDefaults();
  return db.billingPlan.findMany({
    where: onlyActive ? { active: true } : undefined,
    orderBy: { sortOrder: "asc" },
  });
}

export interface PriceItem {
  key: string;
  qty?: number;
}

export async function priceItemsMilli(items: PriceItem[]): Promise<number> {
  const rules = await getRules();
  const map = new Map(rules.map((r) => [r.key, r]));
  let total = 0;
  for (const it of items) {
    const rule = map.get(it.key);
    if (!rule) {
      console.warn("[BILLING] unknown pricing key (charged 0):", it.key);
      continue;
    }
    if (!rule.active) continue;
    total += rule.creditsMilli * (it.qty ?? 1);
  }
  return total;
}

/**
 * Which price applies to an image request. Mirrors the provider choice in the
 * generate routes: a product/reference photo forces OpenAI edit; otherwise the
 * dropdown pick (or IMAGE_PROVIDER) decides.
 */
export function imageKey(opts: { imageProvider?: string | null; productImage?: unknown }): string {
  if (opts.productImage) return "image.edit";
  const provider = opts.imageProvider || process.env.IMAGE_PROVIDER || "together";
  const wantsOpenAI = provider === "openai";
  if (wantsOpenAI && process.env.OPENAI_API_KEY) return "image.openai";
  if (process.env.TOGETHER_API_KEY) return "image.flux";
  return "image.openai";
}
