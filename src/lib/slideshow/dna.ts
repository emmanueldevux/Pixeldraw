// ============================================================
// UXLLY — Study a slideshow style's example slides → written DNA
// Covers what makes the style work as a TikTok photo slideshow: how the
// photos look and feel, which scenes and angles it uses, how captions
// are written and placed, and how the slideshow flows.
// ============================================================
import { getClient } from "@/lib/ai/providers/openai";

const INSTRUCTIONS = (n: number) => `You are a senior social media creative director studying ${n} example slide${n > 1 ? "s" : ""} from a TikTok photo slideshow style.
${n > 1 ? "Find what they share (the style) and note what varies (allowed variety)." : ""}

Write a DNA that lets an AI make NEW slideshows in this exact style, with different topics. Be concrete and short. Never quote the actual words on the slides; describe how the words are written.

Use exactly these headings, plain text:
PHOTO LOOK: camera feel (phone photo, film, polished), lighting, colour mood, grain, depth of field, how real or staged it feels.
SCENES & ANGLES: the kinds of scenes and subjects, framings used (selfie, mirror shot, over-the-shoulder, wide environment, detail shot, POV), and how much variety there is between slides.
PEOPLE: whether a person appears, how (face to camera, back turned, hands only), clothing and styling mood, expressions.
COMPOSITION: where the empty space is for captions, where the subject sits.
CAPTION STYLE: box look (white box, dark translucent box, plain text), position, size, line length, case, emoji use.
CAPTION VOICE: how the words are written (first person, hook question, numbered list, blunt statement), typical length of each line, tone.
FLOW: how the slideshow is structured from the first to the last slide (hook, build, payoff, closing line).
DON'T: the mistakes that would break this style.

200 to 350 words.`;

export async function studyStyle(refs: string[]): Promise<string> {
  const images = refs.slice(0, 6);
  if (images.length === 0) throw new Error("Add at least one example slide first");
  const client = getClient();
  const model = process.env.OPENAI_DNA_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-4o";
  const res = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 1100,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: INSTRUCTIONS(images.length) },
          ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
        ],
      },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI returned no DNA. Try again.");
  return text;
}
