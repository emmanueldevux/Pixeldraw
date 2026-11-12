// ============================================================
// UXLLY Billing — real cost → credits
//
//   credits = provider cost (USD) × (markupPercent / 100) ÷ credit value (USD)
//
// Example with defaults (3× markup, 1 credit = $0.10): an image that cost
// you $0.05 charges 1.5 credits ($0.15).
//
// Real usage comes from usage.ts (every AI call records itself). Estimates
// below are only used for the up-front balance check and for the "about N
// credits" hints, never for the actual charge when real usage exists.
// ============================================================

import type { BillingSettings } from "./settings";
import type { UsageEntry } from "./usage";

// cents per 1M tokens → micro-USD for n tokens = n × cents / 100
const per = (tokens: number, centsPerM: number) => (tokens * centsPerM) / 100;

export function entryCostMicroUsd(e: UsageEntry, s: BillingSettings): number {
  switch (e.kind) {
    case "openai-image":
      return per(e.textInTokens, s.imageTextInCentsPerM) + per(e.imageInTokens, s.imageImageInCentsPerM) + per(e.outTokens, s.imageOutCentsPerM);
    case "openai-text":
      return per(e.inTokens, s.openaiTextInCentsPerM) + per(e.outTokens, s.openaiTextOutCentsPerM);
    case "text":
      return per(e.inTokens, s.textInCentsPerM) + per(e.outTokens, s.textOutCentsPerM);
    case "flux":
      return e.images * s.fluxImageMicroUsd;
  }
}

export function usageCostMicroUsd(entries: UsageEntry[], s: BillingSettings): number {
  return Math.round(entries.reduce((sum, e) => sum + entryCostMicroUsd(e, s), 0));
}

/** Milli-credits for a provider cost, with markup and the minimum charge. */
export function chargeMilliForCost(costMicroUsd: number, s: BillingSettings): number {
  if (costMicroUsd <= 0) return s.minChargeMilli;
  const creditValueMicroUsd = Math.max(1, s.creditValueCents) * 10_000;
  const milli = Math.ceil(((costMicroUsd * (s.markupPercent / 100)) / creditValueMicroUsd) * 1000);
  return Math.max(s.minChargeMilli, milli);
}

// ==================== Image token sizes ====================
// OpenAI's published output tokens for gpt-image at each size/quality.
export function imageOutTokens(size: string, quality: string): number {
  const big = size !== "1024x1024";
  if (quality === "low") return big ? 408 : 272;
  if (quality === "high") return big ? 6240 : 4160;
  return big ? 1584 : 1056; // medium / auto
}

// ==================== Per-action estimates ====================
// "max" = cautious, for the balance check. "typical" = what the user usually pays.
export const ACTION_LABELS: Record<string, string> = {
  "chat.text": "Chat reply",
  "image.openai": "Image (GPT Image)",
  "image.flux": "Image (FLUX)",
  "image.edit": "Image with your product / reference photo",
  "vision.analysis": "Brand / reference analysis",
  "carousel.plan": "Carousel planning (per carousel)",
};

export function estimateMicroUsd(key: string, s: BillingSettings, mode: "max" | "typical" = "max"): number {
  const max = mode === "max";
  const q = process.env.OPENAI_IMAGE_QUALITY || "medium";
  const imgOut = imageOutTokens("1024x1536", max && q === "high" ? "high" : q);
  // the reference-style pipeline also reads the reference with the vision model
  const visionPass = per(max ? 9000 : 4000, s.openaiTextInCentsPerM) + per(max ? 1500 : 700, s.openaiTextOutCentsPerM);
  switch (key) {
    case "chat.text":
      return per(max ? 6000 : 2500, s.textInCentsPerM) + per(max ? 1500 : 600, s.textOutCentsPerM);
    case "image.openai":
      return per(max ? 3000 : 1500, s.imageTextInCentsPerM) + per(max ? 6000 : 1500, s.imageImageInCentsPerM) + per(imgOut, s.imageOutCentsPerM) + visionPass;
    case "image.edit":
      return per(max ? 3000 : 1500, s.imageTextInCentsPerM) + per(max ? 12000 : 3000, s.imageImageInCentsPerM) + per(imgOut, s.imageOutCentsPerM) + visionPass;
    case "image.flux":
      return s.fluxImageMicroUsd;
    case "vision.analysis":
      return per(max ? 40000 : 15000, s.openaiTextInCentsPerM) + per(max ? 5000 : 2500, s.openaiTextOutCentsPerM);
    case "carousel.plan":
      return per(max ? 6000 : 3000, s.textInCentsPerM) + per(max ? 4000 : 2000, s.textOutCentsPerM);
    default:
      return 0;
  }
}

/** Typical charge per action, for the Billing page and admin preview. */
export function typicalCharges(s: BillingSettings) {
  return Object.keys(ACTION_LABELS).map((key) => ({ key, label: ACTION_LABELS[key], creditsMilli: chargeMilliForCost(estimateMicroUsd(key, s, "typical"), s) }));
}
