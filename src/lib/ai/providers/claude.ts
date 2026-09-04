// ============================================================
// UXLLY — Anthropic (Claude) Provider
// Ready for future swap — same interface as other providers
// ============================================================

import type { AICompletionRequest, AICompletionResponse } from "@/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

export async function claudeComplete(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  // Separate system message from conversation
  const systemMessage = request.messages.find((m) => m.role === "system");
  const conversationMessages = request.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: request.model || ANTHROPIC_MODEL,
      max_tokens: request.maxTokens ?? 2048,
      system: systemMessage?.content || undefined,
      messages: conversationMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find(
    (block: { type: string }) => block.type === "text"
  );

  return {
    content: textBlock?.text || "",
    model: data.model || ANTHROPIC_MODEL,
    usage: data.usage
      ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined,
  };
}
