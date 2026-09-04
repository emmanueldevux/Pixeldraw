// ============================================================
// UXLLY — Inspiration Pool Picker
// Queries the curated InspirationImage library by tag match,
// then asks a vision model to pick ONE borrowable technique
// from a small candidate pool. Colors/fonts are never touched —
// only structural/creative techniques (composition, texture,
// lighting, framing, motion).
// ============================================================

import type OpenAI from "openai";
import { db } from "@/lib/db";

export interface InspirationPick {
  url: string;
  technique: string;
}

// ==================== Pick Inspiration ====================

export async function pickInspiration(
  client: OpenAI,
  platform?: string | null,
  mood?: string | null
): Promise<InspirationPick | null> {
  try {
    // Best match: platform + mood
    let pool = await db.inspirationImage.findMany({
      where: {
        AND: [
          platform ? { OR: [{ platform }, { platform: null }] } : {},
          mood ? { OR: [{ mood }, { mood: null }] } : {},
        ],
      },
      take: 6,
      orderBy: { createdAt: "desc" },
    });

    // Fallback: platform only
    if (pool.length === 0 && platform) {
      pool = await db.inspirationImage.findMany({
        where: { OR: [{ platform }, { platform: null }] },
        take: 6,
        orderBy: { createdAt: "desc" },
      });
    }

    // Fallback: anything in the library
    if (pool.length === 0) {
      pool = await db.inspirationImage.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
      });
    }

    if (pool.length === 0) {
      console.log("[INSPIRATION] Pool empty — skipping injection");
      return null;
    }

    // Cap candidates sent to vision for cost control
    const candidates = pool.slice(0, 4);

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = candidates.map(
      (img) => ({
        type: "image_url" as const,
        image_url: { url: img.url, detail: "low" as const },
      })
    );

    content.push({
      type: "text",
      text: `These are ${candidates.length} unrelated design references, numbered 0 to ${candidates.length - 1} in the order shown. Pick the ONE most interesting, borrowable TECHNIQUE across them — a composition trick, texture, framing idea, lighting technique, or motion effect. NEVER pick a color palette or font choice; those are irrelevant here. The technique should be described generically enough to apply to a completely different brand and color scheme. Return ONLY valid JSON, no markdown, no backticks:

{
  "image_index": 0,
  "technique": "one crisp sentence describing the borrowable technique"
}`,
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      max_tokens: 150,
      temperature: 0.6,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { image_index?: number; technique?: string };

    if (!parsed.technique) return null;

    const idx =
      typeof parsed.image_index === "number" && candidates[parsed.image_index]
        ? parsed.image_index
        : 0;

    return { url: candidates[idx].url, technique: parsed.technique };
  } catch (err) {
    console.error("[INSPIRATION] Pick failed, skipping injection:", err);
    return null;
  }
}
