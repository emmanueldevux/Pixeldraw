// ============================================================
// UXLLY — Study a slot's reference slides → written DNA
// The admin uploads 1+ reference slides per slot; the vision model
// writes a precise, reusable design spec for that slot. The admin can
// edit it. Generation follows this text slide after slide.
// ============================================================
import { getClient } from "@/lib/ai/providers/openai";
import type { SlotKey } from "./types";

const ROLE: Record<SlotKey, string> = {
  intro:
    "the INTRO slide (slide 1): the scroll-stopper people see in their feed. It must make them swipe.",
  details:
    "a DETAILS slide (the middle slides). Every details slide in a carousel uses this SAME layout; only the heading, body text and the visual change from slide to slide.",
  outro:
    "the OUTRO slide (the last slide): the closing call to action (share, follow, save, comment, visit).",
};

const INSTRUCTIONS = (slot: SlotKey, n: number) => `You are a senior art director writing a design system for one slide type of a social media carousel style.
The ${n} attached image${n > 1 ? "s are references" : " is a reference"} for ${ROLE[slot]}
${n > 1 ? "Find what they share (that's the style) and note where they vary (that's allowed variety)." : ""}

Write the DNA a designer (or an image model) must follow to make NEW slides of this type with different content that still look like they belong to this exact style. Be concrete and measurable; use percentages of the canvas for positions and sizes. Never describe the specific words, people or logos in the references: describe the system.

Use exactly these headings:
CANVAS & BACKGROUND: colour/texture/paper/grain, margins (in % of width), overall feel.
LAYOUT: the zones top to bottom with % positions and alignment; where the visual sits; what is centred vs left-aligned; how much empty space.
TYPOGRAPHY: each text role (e.g. kicker, title, subtitle, body, labels, credit). For each: font category (e.g. condensed grotesk, high-contrast serif, italic serif), weight, case, relative size (title height as % of canvas), line spacing, and how emphasis is shown (bold words, italic phrases, colour).
TEXT DENSITY: maximum words for each text role, number of lines, paragraph count. Be strict: slides must never get crowded.
VISUAL / IMAGERY: the medium (line illustration, flat vector, painted portrait, photo, 3D, icon), line weight, shading, palette, framing and crop, size as % of canvas, background behind it (card, cut-out, full bleed).
RECURRING ELEMENTS: things that repeat on every slide of this type (swipe cue, arrows, author credit, page number, icons, dividers, badges, handle) with their exact position and style.
COLOUR ROLES: which elements use the dark/primary colour, which use the accent, which stay neutral. (Brand colours will be swapped in, so describe roles, not just hex codes.)
KEEP / CHANGE: what must stay identical on every slide of this type, and what changes per slide.
DON'T: the mistakes that would break this style (e.g. crowding, extra decorations, wrong font mood, centred text where it should be left-aligned).

Plain text with those headings. 250 to 450 words.`;

export async function studySlot(slot: SlotKey, refs: string[]): Promise<string> {
  const images = refs.slice(0, 4);
  if (images.length === 0) throw new Error("Add at least one reference image to this slot first");
  const client = getClient();
  const model = process.env.OPENAI_DNA_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-4o";
  const res = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 1400,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: INSTRUCTIONS(slot, images.length) },
          ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
        ],
      },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI returned no DNA. Try again.");
  return text;
}
