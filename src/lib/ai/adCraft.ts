// ============================================================
// UXLLY — Ad craft (single post ads)
// Two small, free helpers (no extra AI calls) that sharpen every single ad:
//   1. a COPY FRAMEWORK picked from the brief + brand (AIDA, PAS, BAB, FAB…)
//   2. a MOOD hint mapped from the brand's voice (bold/subtle, playful/serious…)
// Ideas adapted from the open-source "Claude Ads" project (copy frameworks and
// voice-to-visual mapping). Frameworks organise a message; they never add facts.
// ============================================================
import type { BrainData } from "@/lib/brain/types";

export interface Framework {
  id: "AIDA" | "PAS" | "BAB" | "FAB" | "OFFER";
  name: string;
  /** How the framework fits the tiny space of ONE image (2-6 word headline + a short line + CTA). */
  how: string;
}

const FRAMEWORKS: Record<Framework["id"], Framework> = {
  OFFER: {
    id: "OFFER",
    name: "Offer-first (AIDA)",
    how: "Headline = the offer or the hook itself, big and instantly readable. One short line of the real benefit. A clear call to action. No filler.",
  },
  PAS: {
    id: "PAS",
    name: "Problem → Solution (PAS)",
    how: "Headline names the customer's problem in their own words (calm, no shame or fear). The supporting line shows how the product solves it. Call to action.",
  },
  BAB: {
    id: "BAB",
    name: "Before → After (BAB)",
    how: "Headline states the better state the customer wants, honestly and without guarantees. The supporting line is how the product gets them there. No invented timelines or results.",
  },
  FAB: {
    id: "FAB",
    name: "Feature → Benefit (FAB)",
    how: "Headline is the benefit to the customer. The supporting line is the real feature behind it. Call to action. Keep to what the brief and brand context state.",
  },
  AIDA: {
    id: "AIDA",
    name: "Attention → Desire → Action (AIDA)",
    how: "Headline grabs attention with one clear idea. One line that makes the customer want it, using a true benefit. A clear call to action.",
  },
};

const RE = {
  offer: /\b(sale|discount|% ?off|\d+ ?%|deal|promo|coupon|code|black friday|cyber monday|clearance|bundle|free shipping|limited|today only|flash)\b/i,
  problem: /\b(problem|struggl\w*|tired of|sick of|stop\b|hate|pain|frustrat\w*|worry|worried|fix|without the)\b/i,
  change: /\b(transform\w*|before and after|results?|journey|glow|upgrade|level up|become|finally)\b/i,
  feature: /\b(launch\w*|new\b|introducing|feature\w*|ingredient\w*|made (with|from)|spec\w*|available now|arrive\w*|collection)\b/i,
};

/** Pick one framework from the request and the brand brain. Purely rule based, free. */
export function pickFramework(brief: string, brain?: BrainData | null): Framework {
  const t = brief || "";
  if (RE.offer.test(t)) return FRAMEWORKS.OFFER;
  if (RE.problem.test(t)) return FRAMEWORKS.PAS;
  if (RE.change.test(t)) return FRAMEWORKS.BAB;
  if (RE.feature.test(t)) return FRAMEWORKS.FAB;
  const hasPain = !!brain?.audience?.some((a) => a.painWords?.length);
  return hasPain ? FRAMEWORKS.PAS : FRAMEWORKS.AIDA;
}

// ==================== Voice → mood ====================

interface Axis {
  a: { words: RegExp; hint: string };
  b: { words: RegExp; hint: string };
}

const AXES: Axis[] = [
  { // formal ↔ casual
    a: { words: /\b(formal|professional|authoritative|refined|polished|elegant|sophisticated)\b/i, hint: "clean symmetrical lines, restrained palette, refined type" },
    b: { words: /\b(casual|friendly|relaxed|conversational|laid[- ]back|chatty|warm|down[- ]to[- ]earth)\b/i, hint: "organic shapes, warm tones, a hand-made feel" },
  },
  { // rational ↔ emotional
    a: { words: /\b(rational|logical|analytical|precise|factual|data|practical)\b/i, hint: "structured grid, clear numbers or proof, cool tones" },
    b: { words: /\b(emotional|heartfelt|inspiring|passionate|empathetic|human|personal)\b/i, hint: "expressive colour, real human warmth, dynamic energy" },
  },
  { // subtle ↔ bold
    a: { words: /\b(subtle|calm|gentle|understated|minimal|quiet|soft|serene)\b/i, hint: "soft contrast, generous white space, thin strokes" },
    b: { words: /\b(bold|loud|confident|punchy|energetic|daring|striking|direct)\b/i, hint: "high contrast, saturated colour, heavy type, full-bleed" },
  },
  { // traditional ↔ innovative
    a: { words: /\b(traditional|heritage|classic|timeless|established|trusted)\b/i, hint: "classic composition, earthy or heritage tones" },
    b: { words: /\b(innovative|modern|futuristic|cutting[- ]edge|disruptive|tech(?:nical)?y?)\b/i, hint: "contemporary layout, gradients, glass or 3D accents" },
  },
  { // serious ↔ playful
    a: { words: /\b(serious|sober|earnest|dignified|grounded)\b/i, hint: "cinematic lighting, restrained decoration" },
    b: { words: /\b(playful|fun|witty|humou?rous|cheeky|quirky|whimsical)\b/i, hint: "whimsical accents, bright candy colours, lively shapes" },
  },
  { // expert ↔ accessible
    a: { words: /\b(expert|technical|specialist|scientific|authoritative)\b/i, hint: "denser, precise information cues" },
    b: { words: /\b(simple|plain|approachable|accessible|easy|beginner)\b/i, hint: "plain-language labels, big clear hierarchy, familiar cues" },
  },
];

/** Map the brand voice to visual mood words. Empty string when the voice gives no signal. */
export function moodFromVoice(brain?: BrainData | null): string {
  if (!brain) return "";
  const v = brain.voice;
  const text = [v.oneLine, ...(v.traits || []), v.rhythm].filter(Boolean).join(" ");
  if (!text.trim()) return "";
  const hints: string[] = [];
  for (const ax of AXES) {
    const hitA = ax.a.words.test(text);
    const hitB = ax.b.words.test(text);
    if (hitA && !hitB) hints.push(ax.a.hint);
    else if (hitB && !hitA) hints.push(ax.b.hint);
  }
  return hints.slice(0, 4).join("; ");
}

// ==================== One note for the image prompt ====================

/**
 * Appended to the brand note of every single-ad render.
 * Claim rule (by design): if the brief or brand context doesn't state a price,
 * number or proof, the AI writes the line WITHOUT it. It never asks and never invents.
 */
export function adCraftNote(brief: string, brain?: BrainData | null): string {
  const fw = pickFramework(brief, brain);
  const mood = moodFromVoice(brain);
  const L = [
    `COPY APPROACH: ${fw.name}. ${fw.how}`,
    "Any price, number, result or proof that is not in the brief or brand context stays OUT of the ad; write a strong line without it.",
  ];
  if (mood) L.push(`MOOD HINTS (only for details the reference leaves open, such as accents, texture and photo feel; the reference's own look wins): ${mood}.`);
  return L.join("\n");
}

// ==================== Reading a studied reference ====================

export interface RefInfo {
  layout: string;
  copyPattern: string;
  mood: string;
  bestFor: string;
}

/** refDnas are plain text with optional "COPY PATTERN:", "MOOD:", "BEST FOR:" lines. */
export function parseRefDna(dna: string): RefInfo {
  const out: RefInfo = { layout: "", copyPattern: "", mood: "", bestFor: "" };
  const lines = (dna || "").split(/\n/);
  const layout: string[] = [];
  for (const l of lines) {
    const m = l.match(/^(COPY PATTERN|MOOD|BEST FOR):\s*(.*)$/i);
    if (!m) { layout.push(l); continue; }
    const k = m[1].toUpperCase();
    if (k === "COPY PATTERN") out.copyPattern = m[2].trim();
    else if (k === "MOOD") out.mood = m[2].trim();
    else out.bestFor = m[2].trim();
  }
  out.layout = layout.join("\n").trim();
  return out;
}
