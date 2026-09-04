// ============================================================
// UXLLY — Typography Skill
// Generic, works for any brand: stops the text model from
// defaulting to "bold uppercase headline" every single time
// regardless of what the brand's actual reference shows.
// Reads the analyzed style guide (rawMarkdown) when available and
// enforces matching its real case/weight/hierarchy pattern; falls
// back to sensible restraint (not maximal boldness/caps) otherwise.
// ============================================================

import type { SkillDefinition, SkillContext } from "./index";

export const typographySkill: SkillDefinition = {
  name: "Typography",
  description:
    "Matches the brand's actual case/weight/size hierarchy from its reference analysis instead of defaulting to bold all-caps headlines every time",

  buildSystemPrompt: (context: SkillContext) => {
    const hasAnalysis = !!context.styleGuide?.rawMarkdown;

    return `## Typography Rules

Do NOT default to "bold, heavy-weight, ALL CAPS" headline treatment as a generic habit. That is only correct if the brand's own reference actually uses that treatment — many brands use mixed-case or sentence-case headlines, lighter weights, or smaller/more restrained sizing. Match what the brand's OWN references actually show, not a generic "bold startup" look.

Weight is not one setting for the whole design. A headline being bold does NOT mean the subheading and body text should also be bold — in most real designs, only the headline is bold/heavy, while supporting text is Regular or Medium weight. When describing typography in your image prompt, state the weight for each text level separately (e.g. "headline: bold; subheading: regular") rather than one blanket weight applied everywhere.

${
  hasAnalysis
    ? `The brand's analyzed reference (in the Visual Style Analysis section above) describes the ACTUAL typography this brand uses — its real case (uppercase / Title Case / Sentence case / lowercase), real weight, and real size relationships between headline, subheading, and body text. Read that analysis and describe typography in your image prompt that matches it precisely. If the analysis doesn't clearly state a case, prefer natural mixed-case over defaulting to all-caps.`
    : `No reference analysis is available yet for this brand. In its absence, default to a moderate, natural treatment — mixed-case headlines, moderate (not maximal) weight, and a clear but not oversized size hierarchy — rather than assuming bold all-caps.`
}

### Position & hierarchy
Vary where text sits across generations rather than defaulting to the same position (e.g. always upper-left or always centered) every time. If the brand has multiple layout patterns available (from its reference analysis), rotate between them based on what fits the specific content — a big stat number sits differently than a long headline. Keep a clear hierarchy (headline unmistakably the largest element, then subheading, then body/caption) but don't inflate every text element to maximum size — restraint and proportion read as more premium than everything being equally huge.`;
  },
};
