// ============================================================
// UXLLY — Carousel planner for styled carousels
// Writes the copy for INTRO → N DETAILS → OUTRO, each slide sized to
// its slot's DNA (text density), in the brand's voice (Brand Brain).
// Retention structure kept from the old planner: the intro earns the
// first swipe, each detail page makes ONE point and pulls to the next,
// the outro makes ONE ask.
// ============================================================
import { aiComplete } from "@/lib/ai/provider";
import type { CarouselStyle } from "./types";

export interface PlannedSlide {
  slideNumber: number;
  role: "intro" | "details" | "outro";
  title: string;
  body: string; // may contain **bold** and *italic* markers for emphasis
  labels: string[]; // small extra texts the slot uses (name tag, kicker, swipe cue, page label…)
  visual: string; // what the slide's image/illustration should show
}

export interface StyledPlan {
  topic: string;
  slides: PlannedSlide[];
}

function parseJson(text: string) {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("Carousel planning failed: no JSON returned");
  return JSON.parse(text.slice(a, b + 1));
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 80)).filter(Boolean).slice(0, 4) : []);

export async function planStyledCarousel(params: {
  topic: string;
  detailCount: number;
  style: CarouselStyle;
  brandName: string;
  brandBrain?: string; // brainToPrompt() block, if the project has one
  authorName?: string;
  handle?: string;
  language?: string;
  ctaGoal?: string;
  slideNotes?: string[]; // e.g. "slide 1 uses the user's photo of their founder"
}): Promise<StyledPlan> {
  const { topic, detailCount, style } = params;
  const total = detailCount + 2;

  const prompt = `You are the copy chief and art director for a ${total}-slide social media carousel for "${params.brandName}".

TOPIC / REQUEST: ${topic}
${params.ctaGoal ? `CALL TO ACTION GOAL: ${params.ctaGoal}` : "CALL TO ACTION GOAL: choose the best fit (share, save, follow, comment, visit)."}
${params.authorName ? `AUTHOR (for credits like "Written by"): ${params.authorName}` : ""}
${params.handle ? `HANDLE (for "follow" lines): @${params.handle}` : ""}
${params.language && params.language !== "English" ? `LANGUAGE: write every word on the slides in natural ${params.language}.` : ""}
${params.slideNotes?.length ? `NOTES FROM THE USER:\n${params.slideNotes.map((n) => `- ${n}`).join("\n")}` : ""}

${params.brandBrain ? `${params.brandBrain}\n` : ""}
The carousel has a fixed design style with three slide types. Write each slide's text to FIT ITS SLIDE TYPE'S DNA, especially TEXT DENSITY and the text roles it lists (kicker, title, subtitle, labels, credit, etc.). Never write more words than the DNA allows; short beats crowded.

=== INTRO DNA (slide 1) ===
${style.introDna || "Big bold title, short subtitle, one strong visual, swipe cue."}

=== DETAILS DNA (slides 2 to ${total - 1}, all the same layout) ===
${style.detailsDna || "Visual on top, bold heading, 2-3 short body lines."}

=== OUTRO DNA (slide ${total}) ===
${style.outroDna || "Centred call to action, one icon, a short follow line."}

STRUCTURE:
1. INTRO: earn the first swipe. A title that grabs, a subtitle that promises what they get (e.g. "5 frameworks to…"), plus any small labels the intro DNA uses (author credit, name tag for the visual, swipe cue).
2. DETAILS: exactly ${detailCount} slides. Each makes ONE clear point with a short heading and a short body. Mark 1-2 key phrases per body with **bold** or *italic* the way the details DNA uses emphasis. Each opens with a fresh angle and leaves a reason to swipe on; never two slides that read the same. Number them if the topic is a list.
3. OUTRO: one single explicit ask tied to the value just delivered, plus the follow/handle line if the outro DNA has one.
4. VISUAL: for every slide, describe what its illustration/photo should show for THAT slide's point, in the medium the DNA describes (e.g. "line illustration of a stressed man at a desk surrounded by pointing colleagues"). Real people are fine for intros; never name or depict a real, identifiable person unless the user asked for it.
5. Truth: never invent statistics, prices, discounts, quotes or claims that aren't in the request or brand context.

Return ONLY JSON:
{"slides":[{"role":"intro","title":"","body":"","labels":[],"visual":""},{"role":"details","title":"","body":"","labels":[],"visual":""},…,{"role":"outro","title":"","body":"","labels":[],"visual":""}]}
"labels" holds small extra texts that slide's DNA uses (e.g. ["Written by ${params.authorName || "the author"}", "Swipe"]); use [] if none.`;

  const res = await aiComplete({ messages: [{ role: "user", content: prompt }], temperature: 0.75, maxTokens: 3000 });
  const parsed = parseJson(res.content) as { slides?: unknown[] };
  const raw = Array.isArray(parsed.slides) ? parsed.slides : [];
  if (raw.length < 2) throw new Error("Carousel planning returned too few slides");

  const toSlide = (x: unknown, role: PlannedSlide["role"], n: number): PlannedSlide => {
    const o = (x || {}) as Record<string, unknown>;
    return { slideNumber: n, role, title: str(o.title, 140), body: str(o.body, 600), labels: arr(o.labels), visual: str(o.visual, 400) };
  };

  // Enforce the structure ourselves: first = intro, last = outro, exactly N details between.
  const introRaw = raw.find((x) => (x as { role?: string })?.role === "intro") ?? raw[0];
  const outroRaw = [...raw].reverse().find((x) => (x as { role?: string })?.role === "outro") ?? raw[raw.length - 1];
  let details = raw.filter((x) => x !== introRaw && x !== outroRaw);
  if (details.length > detailCount) details = details.slice(0, detailCount);
  const slides: PlannedSlide[] = [
    toSlide(introRaw, "intro", 1),
    ...details.map((d, i) => toSlide(d, "details", i + 2)),
  ];
  slides.push(toSlide(outroRaw, "outro", slides.length + 1));
  console.log("[CAROUSEL STYLE] planned", slides.length, "slides:", slides.map((s) => `${s.slideNumber}:${s.role}`).join(" "));
  return { topic, slides };
}
