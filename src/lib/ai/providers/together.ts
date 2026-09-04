// ============================================================
// UXLLY — Together AI Image Provider (FLUX)
// FREE unlimited image generation via FLUX.1 Schnell
// ============================================================

import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
} from "@/types";

const TOGETHER_API_URL = "https://api.together.xyz/v1/images/generations";

export async function togetherGenerateImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error("TOGETHER_API_KEY is not set");

  // Map sizes to closest supported dimensions
  const sizeMap: Record<string, { width: number; height: number }> = {
    "1080x1080": { width: 1024, height: 1024 },
    "1080x1920": { width: 768, height: 1344 },
    "1920x1080": { width: 1344, height: 768 },
    "1200x627": { width: 1344, height: 768 },
    "1200x630": { width: 1344, height: 768 },
    "1600x900": { width: 1344, height: 768 },
    "1280x720": { width: 1344, height: 768 },
    "1000x1500": { width: 768, height: 1344 },
  };

  const dims = sizeMap[request.size] || { width: 1024, height: 1024 };

  // Use FLUX.1 Schnell (free) or FLUX.1 Pro (paid but better)
  const model = process.env.TOGETHER_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell-Free";

  const response = await fetch(TOGETHER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: request.prompt,
      width: dims.width,
      height: dims.height,
      steps: 4,
      n: 1,
      response_format: "url",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Together AI error: ${response.status} — ${error}`);
  }

  const data = await response.json();

  return {
    url: data.data?.[0]?.url || "",
    revisedPrompt: request.prompt,
  };
}