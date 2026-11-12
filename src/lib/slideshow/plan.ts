// ============================================================
// UXLLY — Plan a lifestyle slideshow
// One text call writes the whole shot list: for every slide a photo
// description (a different scene each time), the caption and, for the
// 2-in-1 format, a second photo and caption. Text is suggested here and
// edited later in the slide editor; images carry no words.
// ============================================================
import { aiComplete } from "@/lib/ai/provider";
import type { Character, PlannedSlide, SlideshowFormat, SlideshowPlan } from "./types";

const FORMAT_RULES: Record<SlideshowFormat, string> = {
  list: `FORMAT: hook + numbered list.
- Slide 1 = the hook: a first-person scroll-stopping line that promises the list (e.g. "things that made me look more put together than I was"). No number.
- Middle slides = the list items. text = "1. short title" (numbered in order, lowercase, casual). detail = 1-3 short follow-up lines, each under 12 words, explaining or adding a personal note (separate lines with \\n).
- Last slide = a short closing line (a save/follow nudge in the brand's voice, or a warm sign-off). No number.`,
  story: `FORMAT: story / day in the life.
- A first-person arc told one moment per slide: set-up, build, a turning point, a payoff.
- text = a short caption (under 14 words) in the person's voice, like a caption they typed on TikTok. detail = empty.
- The scenes follow time (morning to night) or progress through the story; the same person throughout.`,
  travel: `FORMAT: travel.
- One destination or trip. Slide 1 = the hook (the place + a feeling or promise).
- Following slides = distinct spots and moments (a street, a view, a meal, a small detail, a local tip) each with a short caption or tip (under 14 words). detail = an optional short tip line.
- Last slide = a closing tip or a save nudge.`,
  split: `FORMAT: 2-in-1 stacked. EVERY slide has TWO photos stacked top and bottom, each with its own short line.
- kind = "split". scene = the TOP photo, scene2 = the BOTTOM photo, text = the top line, text2 = the bottom line.
- The two halves should relate (this vs that, before vs after, expectation vs reality, a sentence split in two). Keep each line under 8 words.`,
};

const clean = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function planSlideshow(opts: {
  topic: string;
  format: SlideshowFormat;
  count: number;
  voice: string; // brand voice/notes (may be empty)
  character: Character | null;
  styleDna: string;
  /** image slots that will be filled with the user's own video frames (their scenes are not rendered) */
  frameSlots: number;
}): Promise<SlideshowPlan> {
  const count = Math.min(10, Math.max(3, Math.round(opts.count)));
  const split = opts.format === "split";
  const prompt = `You are a TikTok photo-slideshow creator who makes lifestyle slideshows that feel personal and native to TikTok.

TOPIC: ${opts.topic}
SLIDES: exactly ${count}
${FORMAT_RULES[opts.format]}
${opts.voice ? `\nVOICE / BRAND NOTES: ${opts.voice}\n` : ""}${opts.character ? `\nMAIN PERSON: "${opts.character.name}". ${opts.character.description}\nWhen a photo shows this person, set person = "character". Vary how: face to camera, mirror selfie, back turned, hands only, walking away, over-the-shoulder. Some photos may show no person at all (person = "none") when the caption is about a thing, place or detail.` : `\nNo named person. Show people only from behind, in silhouette or as hands (person = "anonymous"), or no people (person = "none").`}
${opts.styleDna ? `\nSTYLE TO FOLLOW (a studied reference style):\n${opts.styleDna}\n` : ""}
${opts.frameSlots > 0 ? `The creator will use their own video footage for the first ${opts.frameSlots} photo${opts.frameSlots > 1 ? "s" : ""} (counting ${split ? "top then bottom photo of each slide" : "slide by slide"}, starting from the second slide, then continuing in order). Write captions for those slides that do not depend on what the footage shows.\n` : ""}
RULES FOR EVERY PHOTO DESCRIPTION ("scene"${split ? " and \"scene2\"" : ""}):
- Describe ONE realistic phone photo: place, subject, action, framing, time of day and light, small real details. 25-55 words.
- Every photo must be clearly DIFFERENT from the others: a new location or setting, a new framing and a new light. Never repeat a setting.
- It must look like a genuine unedited iPhone photo, not an ad or stock photo.
- No text, signs with readable words, logos or brand names in the scene.
- Vertical composition with calm, uncluttered space in the top quarter (a caption goes there).

CAPTION RULES: first person, casual, lowercase unless it is a name; short; no hashtags; at most one emoji in the whole slideshow. Do not invent statistics, prices or claims.

Return ONLY JSON:
{"title":"short title","slides":[{"n":1,"kind":"${split ? "split" : "single"}","scene":"","scene2":"","text":"","detail":"","text2":"","person":"character|anonymous|none"}]}`;

  const res = await aiComplete({ messages: [{ role: "user", content: prompt }], temperature: 0.9, maxTokens: 3500 });
  const raw = res.content || "";
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("The AI didn't return a plan. Try again.");
  const j = JSON.parse(raw.slice(a, b + 1)) as { title?: string; slides?: Record<string, unknown>[] };
  const slides: PlannedSlide[] = (j.slides || []).slice(0, count).map((s, i) => {
    const person = s.person === "character" || s.person === "none" ? (s.person as "character" | "none") : "anonymous";
    return {
      n: i + 1,
      kind: split ? "split" : "single",
      scene: clean(s.scene, 700),
      scene2: split ? clean(s.scene2, 700) : "",
      text: clean(s.text, 220),
      detail: split ? "" : clean(s.detail, 400),
      text2: split ? clean(s.text2, 220) : "",
      person: opts.character ? person : person === "character" ? "anonymous" : person,
    };
  });
  if (slides.length < 3) throw new Error("The AI's plan was too short. Try again.");
  return { title: clean(j.title, 80) || opts.topic.slice(0, 60), slides };
}
