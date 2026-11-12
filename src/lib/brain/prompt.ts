// ============================================================
// UXLLY — Brand Brain → prompt block
// A compact text version of the brain for copy/design prompts.
// Step 2 plugs this into chat, image posts, carousels and slideshows.
// ============================================================

import type { BrainData } from "./types";

export function brainToPrompt(b: BrainData, opts: { avatarId?: string } = {}): string {
  const L: string[] = ["=== BRAND BRAIN (who this brand is — use for every word you write) ==="];
  const biz = b.business;
  if (biz.summary || biz.whatYouSell) L.push(`Business: ${biz.name ? biz.name + " — " : ""}${biz.summary || biz.whatYouSell}${biz.location ? ` (${biz.location})` : ""}`);

  const p = b.positioning;
  if (p.counterPosition) L.push(`Positioning: ${p.counterPosition}`);
  if (p.valueProp) L.push(`Value proposition: ${p.valueProp}${p.without ? ` — without ${p.without}` : ""}`);
  if (p.standsAgainst) L.push(`Stands against: ${p.standsAgainst}`);

  const v = b.voice;
  if (v.oneLine) L.push(`Voice: ${v.oneLine}${v.traits.length ? ` (${v.traits.join(", ")})` : ""}`);
  if (v.rhythm || v.address) L.push(`Writing: ${[v.rhythm, v.address, v.emoji && `emoji ${v.emoji}`].filter(Boolean).join("; ")}`);
  if (v.useWords.length) L.push(`Use words like: ${v.useWords.join(", ")}`);
  if (v.avoidWords.length) L.push(`Never use: ${v.avoidWords.join(", ")}`);
  if (v.examples.headline) L.push(`On-voice example headline: "${v.examples.headline}"`);

  const avatars = opts.avatarId ? b.audience.filter((a) => a.id === opts.avatarId) : b.audience;
  if (avatars.length) {
    L.push("Audience:");
    for (const a of avatars.slice(0, 5)) {
      L.push(`- ${a.name} (${a.type}): wants ${a.wants || "—"}; pain words: ${a.painWords.map((w) => `"${w}"`).join(", ") || "—"}; lead with: ${a.adAngle || "—"}`);
    }
  }
  if (b.products.length) {
    L.push("Products:");
    for (const pr of b.products.slice(0, 10)) L.push(`- ${pr.name}${pr.price ? ` (${pr.price})` : ""}: ${pr.description}${pr.claims.length ? ` | ${pr.claims.join("; ")}` : ""}`);
  }
  if (b.offers.length) {
    L.push("Offers (the ONLY offers you may mention — never invent or change one):");
    for (const o of b.offers) L.push(`- ${o.id} ${o.title}${o.code ? ` code ${o.code}` : ""}: ${o.details}`);
    if (b.offerRules) L.push(`Offer rules: ${b.offerRules}`);
  } else {
    L.push("Offers: none. Do NOT mention any discount, price cut, code or guarantee.");
  }
  L.push("Never invent prices, statistics, awards or claims beyond what is listed above.");
  return L.join("\n");
}

/**
 * Short brand note for image prompts (design templates). Only the parts that
 * matter for on-image words: who the brand is, its voice, words to avoid, and
 * the offer rule. Visual style stays with the template / reference.
 */
export function brainImageNote(b: BrainData): string {
  const L: string[] = [];
  if (b.business.name || b.business.whatYouSell) L.push(`Brand: ${[b.business.name, b.business.whatYouSell].filter(Boolean).join(" — ")}.`);
  if (b.voice.oneLine) L.push(`Write every on-image word in this brand's voice: ${b.voice.oneLine}${b.voice.traits.length ? ` (${b.voice.traits.join(", ")})` : ""}.`);
  if (b.positioning.valueProp) L.push(`What the brand promises: ${b.positioning.valueProp}${b.positioning.without ? `, without ${b.positioning.without}` : ""}.`);
  // Selling points the AI may turn into on-image benefits (truthful: they come from the brand brain).
  const products = b.products.filter((p) => p.claims.length || p.description).slice(0, 4);
  if (products.length) {
    L.push("Products and their true selling points (use these for benefits and callouts):");
    for (const p of products) L.push(`- ${p.name}${p.description ? `: ${p.description}` : ""}${p.claims.length ? ` | ${p.claims.join("; ")}` : ""}`);
  }
  const pains = b.audience.flatMap((a) => a.painWords).slice(0, 4);
  if (pains.length) L.push(`What customers care about, in their words: ${pains.map((w) => `"${w}"`).join(", ")}.`);
  if (b.voice.avoidWords.length) L.push(`Never use these words: ${b.voice.avoidWords.join(", ")}.`);
  L.push(b.offers.length
    ? `Only if an offer fits, use one of these exactly as written: ${b.offers.map((o) => o.title + (o.code ? ` (code ${o.code})` : "")).join("; ")}.`
    : "Do not show any discount, price, code or guarantee.");
  return L.length > 1 ? `BRAND CONTEXT:\n${L.join("\n")}` : "";
}
