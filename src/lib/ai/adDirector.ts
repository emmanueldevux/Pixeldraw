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
import { formatLibraryBlock, formatLine, type AdFormat } from "@/lib/ai/adFormats";

/** A request for a single image ad (not a thumbnail, carousel or slideshow). */
/** A message that isn't a request at all ("ff", "asdf", "hmm", "?"): no image should be made and nothing should be charged. */
export function isNonRequest(text: string, hasImage: boolean): boolean {
  if (hasImage) return false;
  const t = (text || "").trim().toLowerCase();
  const letters = t.replace(/[^a-z\u00c0-\uffff]/g, "");
  if (letters.length === 0) return true;
  if (/^(hi|hey|hello|yo|sup|hmm+|ok(ay)?|test(ing)?|thanks?|thx|lol|nice|cool|yes|no)\W*$/.test(t)) return true;
  if (letters.length <= 3 && !/\b(ad|ads|cat|dog|car|sun|sea|tea|pen|bag|hat|bed|cup|toy)\b/.test(t)) return true;
  if (/^(asdf?g?h?j?k?l?|qwer?t?y?|zxcv?b?n?m?|sdf+g?|dfg+h?)$/.test(letters)) return true;
  // keyboard mash: one short word with no vowels, or a single character repeated
  if (!/\s/.test(t) && letters.length < 12 && (!/[aeiouy]/.test(letters) || /^(.)\1+$/.test(letters))) return true;
  return false;
}

export function isAdRequest(text: string, platform?: string): boolean {
  if (/\b(thumbnails?|thumbs?|carousels?|slide\s?shows?)\b/i.test(text)) return false;
  if (platform === "youtube_thumbnail") return false;
  return /\b(ads?|adverts?|advertisements?|advertising|promo(?:tion)?|banner)\b/i.test(text);
}

/** The user explicitly asks for a different style of ad ("a different layout", "surprise me").
 *  A plain "make an ad" or "make another one" is NOT this: it stays on the simple path
 *  (reference pack + composition). */
export function wantsNewFormat(text: string): boolean {
  return /\b(different|new|fresh|unique|another|creative|unusual)\s+(format|layout|style|look|design|kind of ad|type of ad)\b/i.test(text) ||
    /surprise me|something (different|new|else|creative)|try (a )?(new|different) (format|layout|style|kind)/i.test(text);
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

export function adDirectorRule(opts: { inventFormat: boolean; previous: string[]; hasBrain: boolean; hasProductPhoto: boolean; platform?: string; composition?: string; formats?: AdFormat[]; chosen?: AdFormat | null; styles?: string[] }): string {
  const L: string[] = [
    "",
    "AD DIRECTOR MODE (this request is for an ad). Work like a creative team, silently, then answer in the exact reply format at the end.",
    "",
    "1. WHO AND WHY. Pick ONE specific persona: " + (opts.hasBrain ? "choose from the Audience in the brand brain" : "infer one from the request (age, situation, the pain in their own words, what they want, what blocks them)") + ". Pick ONE angle and sell only that (a feature, a pain, an offer or season, a customer's words, a gap against alternatives). One ad = one angle. Note their awareness stage (unaware, problem, solution, product, most aware) and write for it.",
    "",
  ];
  if (opts.inventFormat) {
    if (opts.chosen) {
      L.push(
        "2. FORMAT. The user asked for this format by name, so use exactly it and adapt it to the brand (real product, brand colours, brand voice). Keep its layout and change only the content:",
        "   " + formatLine(opts.chosen),
      );
    } else if (opts.formats?.length) {
      L.push(
        "2. FORMAT. Pick the ONE format below that best fits the persona and angle, keep its layout and change only the content (real product, brand colours, brand voice). Do not default to a centered product with a headline. If none fits, build your own from blocks (hook + product always, plus 1 to 4 more; 2 to 6 blocks in total). Name the format in the Concept line and lay it out by areas with percentages.",
        formatLibraryBlock(opts.formats),
      );
    } else {
      L.push(
        "2. FORMAT. Invent a format built from blocks: hook + product (always) plus 0 to 4 more (subline, callouts, pills, badge, list, table, diagram, chart, timeline, before/after, comparison, faux phone UI such as a text thread, notes app, search bar or lock screen, a metaphor made literal, a real photo scene). Total 2 to 6 blocks. Push past a centered product with a headline: explain the benefit visually. Give the format a 2 to 4 word name and lay it out by areas with percentages (for example: hook top 12%, product centered at 55% height).",
      );
    }
    L.push("   A reference pack may supply the visual STYLE separately (type feel, colour treatment, decoration, finish), so spend this step on the layout and the content, and keep the Design notes short.");
    L.push("   Photo-led formats look like a real iPhone shot (handheld, casual, slightly grainy, no glare, no polished skin). Graphic-led formats put the real product cutout on a background you design. Block counts: a block holds many sub-items but counts once.");
    if (opts.previous.length) L.push(`   Already used in this chat. Do NOT repeat these formats or angles:\n${opts.previous.map((p) => `   - ${p}`).join("\n")}`);
  } else {
    L.push("2. FORMAT. The layout is set by a reference ad chosen separately, so do not invent a layout. Describe the subject, scene, mood and the exact copy; keep the composition notes short. If the reference shows the subject interacting with its product (for example holding it in the mouth), describe the interaction that is natural for THIS product (a bed: the pet lies on it; a bowl: eating from it; a collar: wearing it), at a realistic size, instead of copying the pose.");
  }
  if (!opts.inventFormat && (!opts.composition || opts.composition === "auto")) L.push("   TEXT POSITION: follow the reference ad's layout. Only if the user's request says where the text should go (for example text at the bottom, headline on the left), put it there and keep the reference's look.");
  if (opts.inventFormat && opts.composition && opts.composition !== "auto") L.push("   The user fixed the text position, so use the format as the VISUAL idea only: the hook and subline always go in the one text block at that position. Anything the format draws itself (phone screen, table, chart, callout labels) stays inside the visual and must not overlap the text block.");
  if (opts.composition && opts.composition !== "auto") L.push("   The user fixed the TEXT POSITION (" + opts.composition.replace("-", " ") + "): keep all text in one block there, never move it, and do not invent another text layout. The reference ad still sets the look (style, colours, type, decoration).");
  L.push(
    "",
    "3. COPY. Direct response. The hook leads with the outcome the person wants, not a description of the product. Cold test: with the image covered, a stranger must know what is sold and who it is for. First mention of the brand is brand name plus plain category. Use ONE writing style for hook and subline" + (opts.styles?.length ? " (pick from: " + opts.styles.join(", ") + ")" : " (observational, rhetorical question, conditional, contrarian, confessional, imperative, comparative, testimonial, POV, stat-led, reframe, permission-granting, direct address...)") + ". Lead with the result the reader wants, not a description of the product. After the hook, ask \"so what\": a question or teaser must be paid off by the subline or the visual. Every line must point at something concrete (never a mood or value statement). Say only what the brand brain or reviews support. Max 1 hook and 1 subline; any other text is short labels. If the product is a multi-pack or a variety, show the full set, never a single unit. Active voice, speech-like, no fillers. NEVER use em dashes. Never invent prices, numbers, awards, results or customer quotes; if the request or brand brain does not state one, write a strong line without it.",
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
