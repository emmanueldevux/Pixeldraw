// ============================================================
// UXLLY — Creative Director
// Picks a LAYOUT for this specific generation (content-aware,
// with randomness as a tiebreaker among equally good fits) and
// a BACKGROUND PATTERN (AI-decided, no manual control).
//
// IMPORTANT: layout is only ever overridden when the brand has a
// REAL extracted archetype library (from a detected grid
// reference). With no archetypes, layoutComposition comes back
// null so the caller falls back to the reference's own composition
// — we never substitute a disconnected generic layout over what
// the actual reference shows. Background pattern still varies
// regardless, since that's a minor accent, not a layout override.
// ============================================================

import type OpenAI from "openai";
import type { LayoutArchetype } from "@/types";

export interface CreativeDirection {
  layoutName: string | null;
  layoutComposition: string | null;
  backgroundPattern: string;
}

const BACKGROUND_PATTERNS = [
  "solid flat background, no texture",
  "soft directional gradient",
  "subtle film grain / noise texture",
  "fine dot-grid pattern",
  "thin geometric line-art pattern",
  "soft radial glow or spotlight from one corner",
  "faint blueprint-style grid lines",
];

function pickBackgroundOnly(mood?: string | null): string {
  // Simple weighted-random pick when there's no archetype library to
  // reason about — no need for an LLM call just for this.
  return BACKGROUND_PATTERNS[Math.floor(Math.random() * BACKGROUND_PATTERNS.length)];
}

// ==================== Visual Subject Reasoning ====================
// What should this graphic actually SHOW? Defaulting to "the brand mascot"
// every time regardless of message is lazy and wrong — a mascot fits a
// launch/personality moment, but "we crawl millions of pages" is better
// served by network/globe imagery, a testimonial by people, a stat by
// data visualization, a feature by an abstract icon or UI mockup. This
// reasons about the actual content and picks a genuine fit, falling back
// to the brand mascot only when it's actually the best answer, not the
// only answer.

const SUBJECT_CATEGORIES = [
  {
    key: "brand_mascot",
    hint: "the brand's own mascot/character illustration — best for launch announcements, personality moments, or when the brand character IS the point",
  },
  {
    key: "network_globe",
    hint: "a stylized wireframe globe or interconnected network/node illustration — best for concepts about scale, reach, the internet, connectivity, or infrastructure",
  },
  {
    key: "human_figures",
    hint: "illustrated or photographic human figures — best for testimonials, community, collaboration, or people-centered messages",
  },
  {
    key: "abstract_data",
    hint: "abstract data visualization — charts, graphs, stat callouts — best for metrics, performance, or growth claims",
  },
  {
    key: "product_ui",
    hint: "a UI panel or product/app screenshot mockup — best for feature announcements or product capability messages",
  },
  {
    key: "icon_cluster",
    hint: "a small cluster of simple abstract icons or shapes — best for feature lists or lightweight conceptual messages with no single dominant visual",
  },
  {
    key: "object_metaphor",
    hint: "a single symbolic object or metaphor (a key, a shield, a rocket, etc.) — best when one concrete object captures the message better than any of the above",
  },
];

export async function pickVisualSubject(
  client: OpenAI,
  content: string,
  brandName?: string | null,
  mood?: string | null
): Promise<string> {
  try {
    const categoryList = SUBJECT_CATEGORIES.map((c, i) => `${i}: ${c.key} — ${c.hint}`).join("\n");

    const prompt = `You are an art director deciding what a social graphic should actually ILLUSTRATE — not its layout or colors, just its visual subject matter.

Brand: ${brandName || "not specified"}
Message/content: "${content}"
Mood: ${mood || "not specified"}

Available subject categories:
${categoryList}

Pick whichever category best explains THIS SPECIFIC message. Do not default to the brand mascot unless it's genuinely the best fit for this message — most messages are better served by a concept that illustrates what's being said (e.g. "we crawl the internet" → network/globe imagery, not the brand's mascot animal). Think about what a human designer would actually choose to draw here.

After picking a category, write ONE specific, concrete sentence describing exactly what to illustrate — specific enough for an image generator to render, generic enough to not restate brand colors or fonts.

Return ONLY valid JSON, no markdown, no backticks:
{ "category_index": 0, "subject": "a specific one-sentence description of what to illustrate" }`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.8,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { category_index?: number; subject?: string };

    if (parsed.subject) return parsed.subject;

    // Fallback: use the hint text for whatever category index came back,
    // or a random category if that's missing too.
    const idx =
      typeof parsed.category_index === "number" && SUBJECT_CATEGORIES[parsed.category_index]
        ? parsed.category_index
        : Math.floor(Math.random() * SUBJECT_CATEGORIES.length);
    return SUBJECT_CATEGORIES[idx].hint;
  } catch (err) {
    console.error("[CREATIVE DIRECTOR] Visual subject reasoning failed, using generic fallback:", err);
    return SUBJECT_CATEGORIES[Math.floor(Math.random() * SUBJECT_CATEGORIES.length)].hint;
  }
}

// ==================== Pick Creative Direction ====================

export async function pickCreativeDirection(
  client: OpenAI,
  content: string,
  brandArchetypes: LayoutArchetype[] | null | undefined,
  mood?: string | null
): Promise<CreativeDirection> {
  const hasRealArchetypes = !!brandArchetypes && brandArchetypes.length > 0;

  // No real archetype library — respect the reference's own composition,
  // only vary the background texture.
  if (!hasRealArchetypes) {
    return {
      layoutName: null,
      layoutComposition: null,
      backgroundPattern: pickBackgroundOnly(mood),
    };
  }

  const pool = brandArchetypes as LayoutArchetype[];

  try {
    const archetypeList = pool.map((a, i) => `${i}: ${a.name} — ${a.composition}`).join("\n");
    const bgList = BACKGROUND_PATTERNS.map((b, i) => `${i}: ${b}`).join("\n");

    const prompt = `You are a creative director choosing a layout and background for one social graphic.

Content to display: "${content}"
Brand mood: ${mood || "not specified"}

Available layout archetypes (all extracted from this brand's own real design references):
${archetypeList}

Available background patterns:
${bgList}

Pick the layout archetype that best fits the CONTENT — e.g. a number/stat fits a "big stat number" style layout, a short punchy phrase fits a headline or wordmark style, a feature description fits a UI mockup or icon composition. If more than one archetype fits equally well, pick randomly among the good fits rather than always defaulting to the same one. Then separately pick a background pattern that fits the mood.

Return ONLY valid JSON, no markdown, no backticks:
{ "layout_index": 0, "background_index": 0 }`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 60,
      temperature: 0.9,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { layout_index?: number; background_index?: number };

    const layoutIdx =
      typeof parsed.layout_index === "number" && pool[parsed.layout_index]
        ? parsed.layout_index
        : Math.floor(Math.random() * pool.length);
    const bgIdx =
      typeof parsed.background_index === "number" && BACKGROUND_PATTERNS[parsed.background_index]
        ? parsed.background_index
        : Math.floor(Math.random() * BACKGROUND_PATTERNS.length);

    return {
      layoutName: pool[layoutIdx].name,
      layoutComposition: pool[layoutIdx].composition,
      backgroundPattern: BACKGROUND_PATTERNS[bgIdx],
    };
  } catch (err) {
    console.error("[CREATIVE DIRECTOR] Failed, using random fallback:", err);
    const layout = pool[Math.floor(Math.random() * pool.length)];
    const bg = BACKGROUND_PATTERNS[Math.floor(Math.random() * BACKGROUND_PATTERNS.length)];
    return { layoutName: layout.name, layoutComposition: layout.composition, backgroundPattern: bg };
  }
}
