// ============================================================
// UXLLY — Ad director
// When someone asks for an ad ("make an ad for my cat brand"), the chat model
// works like a small creative team: it picks ONE persona and ONE angle, writes
// the hook with a deliberate style, designs the treatment and (when no reference
// ad is steering the layout) invents a fresh format. Adapted from the Madvera
// image-ad interview, run in a single pass so the user never has to answer
// questions. It shows its choices in a "Concept:" line, and later ads in the
// same chat read those lines so formats and angles are not repeated.
// ============================================================

/** A request for a single image ad (not a thumbnail, carousel or slideshow). */
export function isAdRequest(text: string, platform?: string): boolean {
  if (/\b(thumbnails?|thumbs?|carousels?|slide\s?shows?)\b/i.test(text)) return false;
  if (platform === "youtube_thumbnail") return false;
  return /\b(ads?|adverts?|advertisements?|advertising|promo(?:tion)?|banner)\b/i.test(text);
}

/** The user wants a fresh idea rather than a reference-led layout. */
export function wantsNewFormat(text: string): boolean {
  return /\b(another|more|different|new|fresh|unique|creative|surprise|variation|variations|variety)\b/i.test(text) &&
    /\b(format|layout|style|idea|concept|version|angle|one|ad|ads)\b/i.test(text) ||
    /surprise me|something (different|new|else)|try (a )?(new|different)/i.test(text);
}

/** Concept lines from earlier replies in this chat: "Concept: persona · angle · format". */
export function previousConcepts(messages: { role: string; content: unknown }[]): string[] {
  const out: string[] = [];
  for (const m of messages) {
    if (m.role !== "assistant" || typeof m.content !== "string") continue;
    const hit = m.content.match(/^\s*Concept:\s*(.+)$/im);
    if (hit) out.push(hit[1].trim().slice(0, 200));
  }
  return out.slice(-8);
}

export function adDirectorRule(opts: { inventFormat: boolean; previous: string[]; hasBrain: boolean; hasProductPhoto: boolean; platform?: string }): string {
  const L: string[] = [
    "",
    "AD DIRECTOR MODE (this request is for an ad). Work like a creative team, silently, then answer in the exact reply format at the end.",
    "",
    "1. WHO AND WHY. Pick ONE specific persona: " + (opts.hasBrain ? "choose from the Audience in the brand brain" : "infer one from the request (age, situation, the pain in their own words, what they want, what blocks them)") + ". Pick ONE angle and sell only that (a feature, a pain, an offer or season, a customer's words, a gap against alternatives). One ad = one angle. Note their awareness stage (unaware, problem, solution, product, most aware) and write for it.",
    "",
  ];
  if (opts.inventFormat) {
    L.push(
      "2. FORMAT. Invent a format built from blocks: hook + product (always) plus 0 to 4 more (subline, callouts, pills, badge, list, table, diagram, chart, timeline, before/after, comparison, faux phone UI such as a text thread, notes app, search bar or lock screen, a metaphor made literal, a real photo scene). Total 2 to 6 blocks. Push past a centered product with a headline: explain the benefit visually. Give the format a 2 to 4 word name and lay it out by areas with percentages (for example: hook top 12%, product centered at 55% height).",
    );
    if (opts.previous.length) L.push(`   Already used in this chat. Do NOT repeat these formats or angles:\n${opts.previous.map((p) => `   - ${p}`).join("\n")}`);
  } else {
    L.push("2. FORMAT. The layout is set by a reference ad chosen separately, so do not invent a layout. Describe the subject, scene, mood and the exact copy; keep the composition notes short.");
  }
  L.push(
    "",
    "3. COPY. Direct response. The hook leads with the outcome the person wants, not a description of the product. Cold test: with the image covered, a stranger must know what is sold and who it is for. First mention of the brand is brand name plus plain category. Use ONE writing style for hook and subline (observational, rhetorical question, conditional, contrarian, confessional, imperative, comparative, testimonial, POV, stat-led, reframe, permission-granting, direct address...). Max 1 hook and 1 subline; any other text is short labels. Active voice, speech-like, no fillers. NEVER use em dashes. Never invent prices, numbers, awards, results or customer quotes; if the request or brand brain does not state one, write a strong line without it.",
    "",
    "4. DESIGN. Choose colours (hex, from the brand if given), name fonts with the word \"font\" (for example \"bold grotesque sans font\"), set hierarchy (hook, then product, then support), keep generous spacing, and make text legible at feed size: put text over calm areas, and use an accent colour on the key words, a marker swash, a solid lozenge or a scrim instead of just recolouring.",
    "",
    "5. THE PROMPT. Inside ONE ```prompt block, under 200 words, in this order: Task (\"Create 1 static image ad, " + (opts.platform ? "for " + opts.platform.replace(/_/g, " ") : "4:5") + "\"), Composition (blocks with % positions), Text (the exact copy and its case), Design, Photography direction (only if a photo is needed: looks shot on an iPhone, handheld, casual, a little grainy, imperfect, no glare, no polished skin), Constraints (one image, no logos, no URLs).",
    opts.hasProductPhoto
      ? "   A product photo is attached: name the product, say \"Use the referenced product image. Do not redraw or modify the product or its packaging text, place it as is.\" Do NOT describe how the product looks."
      : "   No product photo is attached: you may describe the product simply. Do not invent packaging text or logos.",
    "   Write the prompt as a direct description of the final image, never as an edit of an earlier one.",
    "",
    "REPLY FORMAT (this replaces any shorter reply rule above). Exactly:",
    "Concept: <persona> · <angle> · <format name>",
    "Hook: <the hook text>",
    "then the ```prompt block. Nothing else.",
  );
  return "\n\n" + L.join("\n");
}
