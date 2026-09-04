// ============================================================
// UXLLY — Carousel Planner
// Translates retention-engineered video-script psychology into
// carousel slide structure. A carousel has the same fundamental
// problem a video does: you have to earn CONTINUED attention one
// unit at a time (watch-seconds ↔ swipes), and most drop-off
// patterns map directly:
//
//   Video hook (Grab/Promise/Stakes, target >70% @ 0:30)
//     → Slide 1: same 3-part structure, must earn the first swipe
//   Pattern interrupt every 60-90s
//     → each content slide opens with a fresh angle, not a flat
//       continuation of the last one
//   Micro-summary + forward hook ending every block
//     → every content slide ends with a forward hook nudging the
//       next swipe — the single highest-leverage carousel technique
//   Mid-CTA (~25% mark)
//     → a soft, low-friction nudge (save/share) folded into a
//       middle slide, never a hard sell
//   Retention re-hook (~60% mark)
//     → only relevant once there's enough slides for a real
//       drop-off risk (6+ slides) — a deliberate re-engagement beat
//   Hard CTA + outro
//     → final slide: one explicit, singular ask
//   Retention risk map
//     → used internally to catch weak slides before generation,
//       not surfaced to the end user
//
// Structural difference from the video skill: a carousel has no
// TIME axis, only SLIDE COUNT — so duration-based structure becomes
// count-based structure.
// ============================================================

import { aiComplete } from "@/lib/ai/provider";
import type { StyleGuideData } from "@/types";

export type SlideRole = "hook" | "content" | "content_rehook" | "cta";

export interface CarouselSlide {
  slideNumber: number;
  role: SlideRole;
  headline: string;
  body: string; // subtext/caption for this slide
  visualSubjectHint: string; // what should be illustrated on this slide specifically
  patternInterrupt?: string; // the "fresh angle" opening this slide, if a content slide
  forwardHook?: string; // the swipe-nudge line, if a content slide
  ctaText?: string; // only on the CTA slide
}

export interface CarouselPlan {
  topic: string;
  totalSlides: number;
  ctaGoal: string;
  slides: CarouselSlide[];
}

// ==================== Slide Count Structure ====================
// Mirrors the video skill's duration math, but for slide count.

function computeSlideRoles(totalSlides: number): SlideRole[] {
  const roles: SlideRole[] = new Array(totalSlides).fill("content");
  roles[0] = "hook"; // slide 1 is always the hook
  roles[totalSlides - 1] = "cta"; // last slide is always the CTA

  // Retention re-hook only matters once there's a real 60%-mark
  // drop-off risk to defend against — short carousels don't need it.
  if (totalSlides >= 6) {
    const rehookIndex = Math.round(totalSlides * 0.6) - 1;
    if (rehookIndex > 0 && rehookIndex < totalSlides - 1) {
      roles[rehookIndex] = "content_rehook";
    }
  }

  return roles;
}

// ==================== Plan a Carousel ====================

export async function planCarousel(params: {
  topic: string;
  brandName: string;
  platform: string;
  styleGuide?: Partial<StyleGuideData> | null;
  slideCountHint?: number | "auto";
  ctaGoal?: string;
}): Promise<CarouselPlan> {
  const { topic, brandName, platform, styleGuide, slideCountHint, ctaGoal } = params;

  const slideCountInstruction =
    typeof slideCountHint === "number"
      ? `Use EXACTLY ${slideCountHint} slides.`
      : `Decide the slide count yourself based on how much this topic genuinely needs to say well — most carousels land between 5 and 8 slides. Do not pad with filler slides just to hit a round number, and don't cram if the topic needs room.`;

  const prompt = `You are planning a social media carousel for the brand "${brandName}" on ${platform}, using retention-engineered structure — the same psychology that makes video scripts hold attention, translated to a swipe-through format.

TOPIC: ${topic}
${ctaGoal ? `CTA GOAL: ${ctaGoal}` : "CTA GOAL: use your judgment based on the topic (follow, save, comment, share, or visit link)"}
${styleGuide?.tone ? `BRAND TONE: ${styleGuide.tone}` : ""}
${styleGuide?.extraNotes ? `BRAND NOTES: ${styleGuide.extraNotes}` : ""}

${slideCountInstruction}

STRUCTURE RULES:
1. SLIDE 1 (Hook) — three parts, back to back: a GRAB (the single most attention-grabbing line, no throat-clearing), a PROMISE (what they'll get from swiping through), and STAKES (why it matters / what they lose by not swiping). This slide must earn the first swipe on its own.
2. CONTENT SLIDES — each one opens with a pattern interrupt (a fresh angle, a surprising framing, a question — NOT a flat continuation of the last slide's point), delivers ONE clear point, and ends with a forward hook that creates a reason to swipe to the next slide (a teaser, an unresolved tension, "but here's the part most people get wrong..."). Never let two consecutive slides feel structurally identical.
3. If there's a slide roughly 60% of the way through, treat it as a RE-HOOK — assume some readers are close to swiping away here, so open it with renewed energy, not just "another point."
4. One content slide near the 25% mark should include a soft, low-friction engagement nudge (e.g. "save this for later") folded naturally into its content — never a hard sell, never its own dedicated slide.
5. FINAL SLIDE (CTA) — one single, explicit, unambiguous ask. No filler like "thanks for reading." Tie the ask directly to the value just delivered.
6. Headlines should be short and punchy — this is a visual medium, not an essay. Body text per slide should be brief enough to read in a couple seconds.

Return ONLY valid JSON, no markdown, no backticks, matching this exact shape:
{
  "totalSlides": <number>,
  "ctaGoal": "<string>",
  "slides": [
    {
      "slideNumber": 1,
      "role": "hook",
      "headline": "<short punchy headline>",
      "body": "<the grab+promise+stakes copy, concise>",
      "visualSubjectHint": "<what should be illustrated on this specific slide>"
    },
    {
      "slideNumber": 2,
      "role": "content",
      "headline": "<short headline>",
      "body": "<the point, concise>",
      "visualSubjectHint": "<what should be illustrated on this specific slide>",
      "patternInterrupt": "<the fresh-angle opening line/idea>",
      "forwardHook": "<the swipe-nudge line/idea>"
    }
  ]
}`;

  const response = await aiComplete({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    maxTokens: 3000,
  });

  const raw = response.content.trim();
  const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();

  let parsed: { totalSlides?: number; ctaGoal?: string; slides?: CarouselSlide[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[CAROUSEL] Failed to parse plan JSON:", err, "raw:", raw.slice(0, 300));
    throw new Error("Carousel planning failed — could not parse the generated plan.");
  }

  if (!parsed.slides || parsed.slides.length === 0) {
    throw new Error("Carousel planning returned no slides.");
  }

  // Recompute roles ourselves rather than fully trusting the model's
  // "role" field — guarantees slide 1 is always hook, last is always
  // cta, and the re-hook lands at a sane position, regardless of what
  // the model labeled things.
  const roles = computeSlideRoles(parsed.slides.length);
  const slides: CarouselSlide[] = parsed.slides.map((s, i) => ({
    ...s,
    slideNumber: i + 1,
    role: roles[i],
  }));

  console.log(
    "[CAROUSEL] 📋 Planned", slides.length, "slides —",
    slides.map((s) => `${s.slideNumber}:${s.role}`).join(", ")
  );

  return {
    topic,
    totalSlides: slides.length,
    ctaGoal: parsed.ctaGoal || ctaGoal || "engage",
    slides,
  };
}
