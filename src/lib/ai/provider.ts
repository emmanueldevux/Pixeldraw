// ============================================================
// UXLLY — AI Provider Router (Modular)
// Swap between DeepSeek, OpenAI, Claude by changing one env var
// ============================================================

import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from "@/types";
import { deepseekComplete } from "./providers/deepseek";
import { openaiComplete } from "./providers/openai";
import { claudeComplete } from "./providers/claude";

// ==================== Provider Registry ====================

const providers: Record<
  AIProvider,
  (req: AICompletionRequest) => Promise<AICompletionResponse>
> = {
  deepseek: deepseekComplete,
  openai: openaiComplete,
  anthropic: claudeComplete,
};

// ==================== Main Entry Point ====================

export async function aiComplete(
  request: AICompletionRequest
): Promise<AICompletionResponse> {
  const providerKey = (process.env.AI_TEXT_PROVIDER || "deepseek") as AIProvider;
  const completeFn = providers[providerKey];

  if (!completeFn) {
    throw new Error(`Unknown AI provider: ${providerKey}`);
  }

  return completeFn(request);
}

// ==================== Get Active Provider Info ====================

export function getActiveProvider(): {
  key: AIProvider;
  name: string;
  model: string;
} {
  const key = (process.env.AI_TEXT_PROVIDER || "deepseek") as AIProvider;

  const info: Record<AIProvider, { name: string; model: string }> = {
    deepseek: {
      name: "DeepSeek",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    },
    openai: {
      name: "OpenAI",
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    },
    anthropic: {
      name: "Claude",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    },
  };

  return { key, ...info[key] };
}
