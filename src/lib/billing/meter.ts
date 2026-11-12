// ============================================================
// UXLLY Billing — meter (what the AI routes call)
//
//   const auth = await authorize(userId, [{ key: "chat.text" }, { key: "image.openai" }], { trial: "consume" });
//   ... run the AI work ...
//   await commit(userId, auth, [{ key: "chat.text" }, { key: "image.openai" }], { ref, producedImage: true });
//
// REAL-COST PRICING:
// authorize() = CHECK FIRST against a cautious estimate of the listed
//   actions (402 → top-up popup before any AI money is spent), and START
//   RECORDING from this point (the route must be wrapped with withUsage()).
// commit() = CHARGE AFTER SUCCESS: the real usage recorded since authorize()
//   × markup. If nothing was recorded (provider gave no usage), it falls back
//   to the estimate of the actions that actually ran. Failed work costs nothing.
//
// trial modes:
//   "consume" — a free-trial user passes; a produced image uses one allowance
//   "pass"    — a free-trial user passes without using an allowance (e.g. brand analysis)
//   "none"    — never free (carousels, scheduled jobs)
// ============================================================

import { getBalanceMilli, debitCredits } from "./ledger";
import { freeTrialStatus, recordFreeUse } from "./free";
import { getSettings } from "./settings";
import { currentUsage, type UsageRecorder } from "./usage";
import { chargeMilliForCost, estimateMicroUsd, usageCostMicroUsd } from "./metered";

export interface PriceItem {
  key: string;
  qty?: number;
}

export class InsufficientCreditsError extends Error {
  code = "insufficient_credits";
  constructor(public neededMilli: number, public balanceMilli: number) {
    super("Not enough credits");
  }
}

export interface Authorization {
  userId: string;
  free: boolean;
  trialConsume: boolean;
  neededMilli: number;
  balanceMilli: number;
  recorder?: UsageRecorder;
  /** index in recorder.entries where this job started */
  usageStart?: number;
}

function mark() {
  const recorder = currentUsage();
  if (!recorder) console.warn("[BILLING] Route is not wrapped with withUsage(): AI usage can't be measured, typical estimates will be charged.");
  return { recorder, usageStart: recorder?.entries.length ?? 0 };
}

async function estimateItems(items: PriceItem[], mode: "max" | "typical") {
  const s = await getSettings();
  const micro = items.reduce((sum, it) => sum + estimateMicroUsd(it.key, s, mode) * Math.max(1, it.qty ?? 1), 0);
  return { s, micro };
}

export async function authorize(
  userId: string,
  items: PriceItem[],
  opts: { trial?: "consume" | "pass" | "none" } = {},
): Promise<Authorization> {
  const trial = opts.trial ?? "none";
  const { s, micro } = await estimateItems(items, "max");
  const neededMilli = chargeMilliForCost(micro, s);

  if (trial !== "none") {
    const status = await freeTrialStatus(userId);
    if (status.available) {
      return { userId, free: true, trialConsume: trial === "consume", neededMilli, balanceMilli: 0, ...mark() };
    }
  }

  const balanceMilli = await getBalanceMilli(userId);
  if (balanceMilli < neededMilli) throw new InsufficientCreditsError(neededMilli, balanceMilli);
  return { userId, free: false, trialConsume: false, neededMilli, balanceMilli, ...mark() };
}

export async function commit(
  userId: string,
  auth: Authorization,
  actual: PriceItem[],
  opts: { ref: string; producedImage?: boolean; note?: string },
): Promise<{ chargedMilli: number; costMicroUsd: number; free: boolean }> {
  const s = await getSettings();
  const entries = auth.recorder ? auth.recorder.entries.slice(auth.usageStart ?? 0) : [];
  const measured = entries.length > 0;
  if (!measured && actual.length > 0) {
    console.warn("[BILLING] No measured AI usage for", actual.map((a) => a.key).join(","), "— charging the typical estimate instead.");
  }
  const costMicroUsd = measured ? usageCostMicroUsd(entries, s) : (await estimateItems(actual, "typical")).micro;

  if (auth.free) {
    if (auth.trialConsume && opts.producedImage) await recordFreeUse(userId, opts.ref);
    return { chargedMilli: 0, costMicroUsd, free: true };
  }
  if (!measured && actual.length === 0) return { chargedMilli: 0, costMicroUsd: 0, free: false };

  const chargedMilli = chargeMilliForCost(costMicroUsd, s);
  await debitCredits({
    userId,
    amountMilli: chargedMilli,
    ref: opts.ref,
    note: opts.note ?? actual.map((a) => (a.qty && a.qty > 1 ? `${a.key} ×${a.qty}` : a.key)).join(", "),
    meta: { items: actual, usage: entries, measured, costMicroUsd, markupPercent: s.markupPercent },
  });
  // Fire-and-forget auto-reload; never let a Stripe problem break a finished generation.
  import("./flows").then((f) => f.maybeAutoReload(userId)).catch(() => {});
  return { chargedMilli, costMicroUsd, free: false };
}

/**
 * Bill a follow-up step of work that was already authorized earlier
 * (e.g. a carousel round in its own request). Charges what THIS request
 * measures from now on; use with commit().
 */
export function meterFollowUp(userId: string): Authorization {
  const recorder = currentUsage();
  return { userId, free: false, trialConsume: false, neededMilli: 0, balanceMilli: 0, recorder, usageStart: recorder?.entries.length ?? 0 };
}
