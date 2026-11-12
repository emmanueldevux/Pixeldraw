// ============================================================
// UXLLY Billing — per-request AI usage recorder
//
// Every AI call (OpenAI chat/vision/images, DeepSeek, Claude, FLUX)
// reports what it really used. authorize() starts a fresh recorder for
// the request; commit() adds it up and charges cost × markup.
//
// Each API route handler is wrapped with withUsage(): the whole request runs
// inside its own recorder (AsyncLocalStorage.run), so concurrent requests can
// never see each other's usage. authorize() marks where its job starts in
// the recorder; commit() charges everything recorded after that mark.
// ============================================================

import { AsyncLocalStorage } from "node:async_hooks";

export type UsageEntry =
  | { kind: "openai-text"; model: string; inTokens: number; outTokens: number }
  | { kind: "openai-image"; model: string; textInTokens: number; imageInTokens: number; outTokens: number }
  | { kind: "text"; provider: string; model: string; inTokens: number; outTokens: number }
  | { kind: "flux"; model: string; images: number };

export interface UsageRecorder {
  entries: UsageEntry[];
  /** The project's negative prompt for this request (appended to every image call). */
  negative?: string;
}

const als = new AsyncLocalStorage<UsageRecorder>();

/** Wrap a route handler so every AI call inside it is recorded for billing. */
export function withUsage<A extends unknown[], R>(handler: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return (...args: A) => als.run({ entries: [] }, () => handler(...args));
}

export function currentUsage(): UsageRecorder | undefined {
  return als.getStore();
}

/** Set the project's negative prompt for the rest of this request. */
export function setNegativePrompt(text: unknown) {
  const rec = als.getStore();
  if (!rec) return;
  // Always overwrite (also clears), so one job's rules never leak into the next in a loop.
  rec.negative = typeof text === "string" && text.trim() ? text.trim().slice(0, 600) : undefined;
}

/** Read the project's negative prompt from StyleGuide.advancedSettings and apply it to this request. */
export function applyProjectNegative(advancedSettings: unknown) {
  setNegativePrompt((advancedSettings as { negativePrompt?: unknown } | null | undefined)?.negativePrompt);
}

export function currentNegative(): string | undefined {
  return als.getStore()?.negative;
}

export function recordUsage(entry: UsageEntry) {
  const rec = als.getStore();
  if (rec) rec.entries.push(entry);
}

// ==================== Adapters for provider responses ====================

type OpenAIChatUsage = { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
type OpenAIImageUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
} | null | undefined;

export function recordOpenAIText(model: string, usage: OpenAIChatUsage) {
  if (!usage) return;
  recordUsage({ kind: "openai-text", model, inTokens: usage.prompt_tokens ?? 0, outTokens: usage.completion_tokens ?? 0 });
}

export function recordOpenAIImage(model: string, usage: OpenAIImageUsage, fallback: { textIn: number; imageIn: number; out: number }) {
  if (usage && typeof usage.output_tokens === "number") {
    const d = usage.input_tokens_details || {};
    const image = d.image_tokens ?? 0;
    const text = d.text_tokens ?? Math.max(0, (usage.input_tokens ?? 0) - image);
    recordUsage({ kind: "openai-image", model, textInTokens: text, imageInTokens: image, outTokens: usage.output_tokens });
  } else {
    // Model didn't report usage: record a sensible estimate so the job is still billed.
    recordUsage({ kind: "openai-image", model, textInTokens: fallback.textIn, imageInTokens: fallback.imageIn, outTokens: fallback.out });
  }
}
