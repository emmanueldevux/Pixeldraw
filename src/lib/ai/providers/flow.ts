// ============================================================
// UXLLY — Nano Banana image provider (through the flow-worker)
// Sends the prompt + reference images to the flow-worker service, which makes the
// image in Google Flow with one of the pooled accounts and returns an image URL.
// Selected with imageProvider "nanobanana" (composer dropdown) or IMAGE_PROVIDER=nanobanana.
// ============================================================

import { brandRulesText } from "@/lib/billing/usage";
import type { ImageGenerationRequest, ImageGenerationResponse } from "@/types";

export function flowConfigured(): boolean {
  return !!(process.env.FLOW_WORKER_URL && process.env.FLOW_WORKER_TOKEN);
}

export async function flowGenerateImage(
  request: ImageGenerationRequest & { referenceImages?: string[]; productImage?: string | null }
): Promise<ImageGenerationResponse> {
  const base = process.env.FLOW_WORKER_URL;
  const token = process.env.FLOW_WORKER_TOKEN;
  if (!base || !token) throw new Error("Nano Banana is not configured (FLOW_WORKER_URL / FLOW_WORKER_TOKEN)");

  // Two different things go to Flow: the user's product photo / attachments, and ONE style reference.
  // Flow takes a single reference, so only the first style reference is sent (the product photo is not a reference).
  const attachments = [request.productImage].filter((r): r is string => !!r);
  const reference = (request.referenceImages || []).find((r) => !!r) || null;
  const rules = brandRulesText();
  const prompt = rules ? `${request.prompt}\n\n${rules}` : request.prompt;

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
