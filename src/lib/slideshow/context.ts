// UXLLY — load what a slideshow call needs about a project (server only)
import { db } from "@/lib/db";
import { getBrain } from "@/lib/brain/generate";
import { isEmptyBrain } from "@/lib/brain/types";
import { applyProjectNegative } from "@/lib/billing/usage";
import { cleanCharacters, type Character } from "./types";

export async function loadContext(userId: string, brandId: string): Promise<{ voice: string; characters: Character[] } | null> {
  const brand = await db.brand.findFirst({ where: { id: brandId, userId }, include: { styleGuide: true } });
  if (!brand) return null;
  const adv = ((brand.styleGuide as unknown as { advancedSettings?: Record<string, unknown> } | null)?.advancedSettings) || {};
  applyProjectNegative(adv);
  const brain = await getBrain(brandId).catch(() => null);
  let voice = "";
  if (brain && !isEmptyBrain(brain.data)) {
    const v = brain.data.voice;
    voice = [v.oneLine, v.traits.length ? `traits: ${v.traits.join(", ")}` : "", v.avoidWords.length ? `never use: ${v.avoidWords.join(", ")}` : ""].filter(Boolean).join("; ");
  }
  return { voice, characters: cleanCharacters(adv.characters) };
}
