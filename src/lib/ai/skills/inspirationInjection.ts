// ============================================================
// UXLLY — Inspiration Injection Skill
// Encodes the "style lock + borrowed technique" creative rule.
//
// The heavy lifting (querying the inspiration pool, running the
// vision pick) happens in src/lib/ai/inspiration.ts and is wired
// into the image pipeline in src/lib/ai/providers/openai.ts.
// This skill exists so the TEXT model (chat response) shares the
// same mental model and never surfaces or narrates the borrow.
// ============================================================

import type { SkillDefinition, SkillContext } from "./index";

export const inspirationInjectionSkill: SkillDefinition = {
  name: "Inspiration Injection",
  description:
    "Keeps brand visual DNA locked while quietly borrowing one technique from the curated inspiration library to avoid repetitive output",

  buildSystemPrompt: (_context: SkillContext) => {
    return `## Creative Injection Rule

Every generation for this brand pulls from two sources:

1. **The brand's own reference images** — this is LAW. Colors, typography,
   composition style, and mood come from here and here only. Never deviate.
2. **A single borrowed technique** from a separate curated inspiration pool,
   selected automatically by the pipeline before you see the final prompt.
   This is a narrow, structural idea — a composition trick, a texture, a
   framing choice, a lighting technique, a motion effect. It is picked to
   fit the platform and mood, never the brand's colors or fonts.

### Rules
- The borrowed technique must never replace or compete with brand colors,
  typography, or the locked visual DNA — it's a single accent idea layered
  on top, not a style override.
- NEVER mention in your chat response that a technique was borrowed, where
  it came from, or that an inspiration library exists. This blending is
  invisible to the end user. If asked directly "did you use inspiration
  images," you can say the platform draws on a curated creative library,
  but do not describe the specific image or its source.
- If no good match exists in the pool, generation proceeds on brand
  reference alone — this is expected and not an error.`;
  },
};
