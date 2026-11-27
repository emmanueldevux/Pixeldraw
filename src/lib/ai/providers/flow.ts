// ============================================================
// UXLLY — Nano Banana image provider (through the flow-worker)
// Sends the prompt + reference images to the flow-worker service, which makes the
// image in Google Flow with one of the pooled accounts and returns an image URL.
// Selected with imageProvider "nanobanana" (composer dropdown) or IMAGE_PROVIDER=nanobanana.
// ============================================================

import { brandRulesText } from "@/lib/billing/usage";
import type { ImageGenerationRequest, ImageGenerationResponse } from "@/types";
import type { StyleGuideData } from "@/types";
import { prepareForFlow } from "@/lib/ai/providers/openai";

export function flowConfigured(): boolean {
  return !!(process.env.FLOW_WORKER_URL && process.env.FLOW_WORKER_TOKEN);
}

export async function flowGenerateImage(
  request: ImageGenerationRequest & {
    referenceImages?: string[];
    productImage?: string | null;
    attachments?: string[];          // more attached images (product shots etc.), if the caller has them
    styleGuide?: Partial<StyleGuideData> | null;
    platform?: string;
    brandName?: string | null;
  }
): Promise<ImageGenerationResponse> {
  const base = process.env.FLOW_WORKER_URL;
  const token = process.env.FLOW_WORKER_TOKEN;
  if (!base || !token) throw new Error("Nano Banana is not configured (FLOW_WORKER_URL / FLOW_WORKER_TOKEN)");

  // Same prompt the OpenAI path would build (brand colours, tone, font, layout direction...), plus ONE style
  // reference with its colour stripped. Flow only draws; the brand wrapper is built here.
  const prepared = await prepareForFlow({
    prompt: request.prompt,
    size: request.size,
    referenceImages: request.referenceImages,
    styleGuide: request.styleGuide,
    platform: request.platform,
    brandName: request.brandName,
    productImage: request.productImage,
  });

  // Attachments (the product photo and any others) are a different thing from the single style reference.
  const maxAttachments = Math.max(1, Number(process.env.FLOW_MAX_ATTACHMENTS || 3));
  const attachments = [request.productImage, ...(request.attachments || [])]
    .filter((r): r is string => !!r)
    .slice(0, maxAttachments);
  const reference = prepared.reference;
  const rules = brandRulesText();
  const prompt = rules ? `${prepared.prompt}\n\n${rules}` : prepared.prompt;
  console.log("[FLOW] prompt:", prepared.structured ? "structured (same as OpenAI)" : "standard brand prompt",
    "| attachments:", attachments.length, "| reference:", reference ? "yes" : "no");

  // The worker waits for the image itself (default 240s). Give the request a little longer than that.
  const res = await fetch(`${base.replace(/\/$/, "")}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt, size: request.size, attachments, reference }),
    signal: AbortSignal.timeout(Number(process.env.FLOW_WORKER_TIMEOUT_MS || 270_000)),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = typeof j?.detail === "string" ? j.detail : j?.detail?.error || JSON.stringify(j).slice(0, 200);
    } catch {
      detail = (await res.text().catch(() => "")).slice(0, 200);
    }
    throw new Error(`Nano Banana worker error: ${res.status} — ${detail}`);
  }

  const data = await res.json();
  if (!data?.url) throw new Error("Nano Banana worker returned no image");
  return { url: data.url, revisedPrompt: request.prompt };
}
