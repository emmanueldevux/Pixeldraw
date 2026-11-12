// ============================================================
// UXLLY — Critic pass
// A cheap vision check on a finished design: misspelled words, off-brand
// colours, crowding, a covered/missing logo, text too near the edges.
// Returns a verdict and short fix instructions the generator can follow
// on ONE retry. Never blocks: if the check itself fails, the image passes.
// ============================================================
import { getClient, getVisionModel } from "@/lib/ai/providers/openai";

export interface CriticInput {
  imageUrl: string;
  expectedText?: string[]; // words that must appear exactly (headline etc.)
  colours?: string | null; // brand colour description
  hasLogo?: boolean;
  aspect?: "4:5" | "1:1" | "9:16" | string;
}

export interface CriticVerdict {
  ok: boolean;
  issues: string[];
  fix: string; // one short paragraph added to the retry prompt
}

export async function critiqueImage(input: CriticInput): Promise<CriticVerdict> {
  const pass: CriticVerdict = { ok: true, issues: [], fix: "" };
  if (!input.imageUrl || !process.env.OPENAI_API_KEY) return pass;
  try {
    const client = getClient();
    const res = await client.chat.completions.create({
      model: getVisionModel(),
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a strict art director checking a finished social media design. Reply as JSON only: {"ok": boolean, "issues": string[]}. List ONLY real, clearly visible problems, each under 18 words: (1) any misspelled, garbled or nonsense word; (2) text that is hard to read (low contrast, too small); (3) a crowded layout; (4) text or key elements within 5% of an edge' +
            (input.aspect === "4:5" ? " or in the top/bottom 9%" : "") +
            "; (5) colours clearly different from the brand colours; (6) a logo that is covered or clipped. Do not nitpick style. If it is good, return ok true with an empty list.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                input.expectedText?.length ? `Text that must appear exactly: ${input.expectedText.map((t) => `"${t}"`).join(", ")}.` : "",
                input.colours ? `Brand colours: ${input.colours}` : "",
                input.hasLogo ? "A brand logo should be visible and uncovered." : "",
              ]
                .filter(Boolean)
                .join("\n") || "Check this design.",
            },
            { type: "image_url", image_url: { url: input.imageUrl } },
          ],
        },
      ],
    });
    const raw = res.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as { ok?: boolean; issues?: unknown };
    const issues = Array.isArray(parsed.issues) ? parsed.issues.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
    if (parsed.ok !== false && issues.length === 0) return pass;
    return {
      ok: false,
      issues,
      fix: `Fix these problems from the previous attempt: ${issues.join("; ")}. Keep everything else the same. Spell every word exactly.`,
    };
  } catch (e) {
    console.warn("[CRITIC] check failed, letting the image through:", (e as Error).message);
    return pass;
  }
}
