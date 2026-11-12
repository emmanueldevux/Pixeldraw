// ============================================================
// UXLLY — Draft a content plan
// Slots (dates, times, platforms, sizes) are made in code. The AI only
// decides WHAT each post is about, using the Brand Brain, the user's goals,
// the occasions in the range and what it already planned (no repeats).
// Nothing is generated and no credits are spent beyond the text drafting.
// ============================================================
import { aiComplete } from "@/lib/ai/provider";
import { getBrain } from "@/lib/brain/generate";
import { brainToPrompt } from "@/lib/brain/prompt";
import { isEmptyBrain } from "@/lib/brain/types";
import { occasionsBetween } from "./holidays";
import type { PlanFormat, Slot } from "./slots";

export interface DraftedItem {
  slot: Slot;
  format: PlanFormat;
  topic: string;
  theme: string;
}

const GOAL_TEXT: Record<string, string> = {
  sales: "drive sales",
  awareness: "build brand awareness",
  followers: "grow followers",
  engagement: "get comments, saves and shares",
  launch: "launch a product",
  events: "promote events and offers",
  save_time: "keep a steady posting rhythm",
};

function extractJson(text: string): unknown {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (m ? m[1] : text).trim();
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  return JSON.parse(start >= 0 && end > start ? body.slice(start, end + 1) : body);
}

export async function draftPlanItems(opts: {
  brandId: string;
  brandName: string;
  slots: Slot[];
  goals: string[];
  brief?: string;
  language?: string;
  carouselShare?: number; // 0..1 target share of carousels (default 0.3)
}): Promise<DraftedItem[]> {
  const { slots } = opts;
  if (slots.length === 0) return [];
  const brain = await getBrain(opts.brandId).catch(() => null);
  const brainText = brain && !isEmptyBrain(brain.data) ? brainToPrompt(brain.data) : "";
  const first = slots[0].scheduledAt;
  const last = slots[slots.length - 1].scheduledAt;
  const occasions = occasionsBetween(first, last);
  const goals = opts.goals.map((g) => GOAL_TEXT[g] || g).join(", ") || "grow the business";
  const share = Math.min(0.6, Math.max(0, opts.carouselShare ?? 0.3));

  const out: DraftedItem[] = [];
  const BATCH = 24;
  for (let from = 0; from < slots.length; from += BATCH) {
    const batch = slots.slice(from, from + BATCH);
    const lines = batch.map((s) => `${s.index}: ${s.localDate} ${s.localTime} · ${s.platform}${s.carouselOk ? "" : " (single image only)"}`).join("\n");
    const done = out.map((o) => o.topic).slice(-40);
    const prompt = [
      `You are the social media strategist for "${opts.brandName}". Plan what each post slot below is about.`,
      brainText ? `\n${brainText}\n` : "",
      `GOALS: ${goals}.`,
      opts.brief ? `USER'S BRIEF FOR THIS PLAN (follow it): ${opts.brief}` : "",
      occasions.length ? `OCCASIONS IN THIS PERIOD (use the relevant ones, on or just before the date): ${occasions.map((o) => `${o.date} ${o.name}`).join("; ")}. Also add any other well-known occasion (e.g. Eid, Ramadan, local events) that really falls in these dates and fits the brand.` : "",
      done.length ? `ALREADY PLANNED (do not repeat): ${done.join(" | ")}` : "",
      "",
      "SLOTS (index: local date time · platform):",
      lines,
      "",
      `Rules: mix the content (offers/product spotlights, social proof, education/tips, behind the scenes, relatable moments, occasions) around the goals. About ${Math.round(share * 100)}% should be carousels ("carousel"), only where the slot allows it; the rest "single". Carousels suit tips, how-tos, comparisons, stories and lists. NEVER invent prices, discounts, codes, stock or claims: only use offers that appear in the brand context; otherwise promote value, not a price. Each topic is a concrete 1-2 sentence brief (the angle, what to show, who it speaks to), not a vague title.${opts.language ? ` Write topics in ${opts.language}.` : ""}`,
      "",
      'Reply with ONLY a JSON array, one object per slot: [{"i": <slot index>, "format": "single"|"carousel", "theme": "<2-3 word label>", "topic": "<brief>"}]',
    ]
      .filter((l) => l !== "")
      .join("\n");

    let parsed: { i: number; format?: string; theme?: string; topic?: string }[] = [];
    for (let attempt = 0; attempt < 2 && parsed.length === 0; attempt++) {
      try {
        const res = await aiComplete({ messages: [{ role: "user", content: prompt }], temperature: 0.8, maxTokens: 4000 });
        parsed = extractJson(res.content) as typeof parsed;
      } catch (e) {
        console.warn("[PLAN] draft batch failed (attempt", attempt + 1, "):", (e as Error).message);
      }
    }
    for (const s of batch) {
      const p = parsed.find((x) => Number(x?.i) === s.index);
      out.push({
        slot: s,
        format: p?.format === "carousel" && s.carouselOk ? "carousel" : "single",
        theme: (p?.theme || "").toString().slice(0, 40),
        topic: (p?.topic || `A helpful post for ${opts.brandName}`).toString().slice(0, 600),
      });
    }
  }
  return out;
}
