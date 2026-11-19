// ============================================================
// UXLLY — Ad format library
// 37 named static-ad formats (from the Madvera image-ad skill). Each one is a
// layout in canvas percentages, so the ad director can pick a different, proven
// idea every time instead of inventing the same few layouts.
//   namedFormat(text)      user asked for a format by name -> use exactly that one
//   candidateFormats(...)  a repeatable shortlist of 8 that skips formats already used
//   formatLibraryBlock()   the shortlist as text for the director prompt
// Also holds the hook writing styles, shortlisted the same way for variety.
// ============================================================

export type AdFormat = {
  name: string;
  base: "graphic" | "photo"; // graphic = product cutout on a built background; photo = real scene
  layout: string; // blocks + canvas percentages
  suits: string; // what it sells well
  aliases?: string[]; // names the user might type
  needsCue?: boolean; // generic word: only counts with "as a / like a / in the style of / format"
};

export const AD_FORMATS: AdFormat[] = [
  { name: "iMessage thread", base: "graphic", layout: "Phone chat screen fills 85% of canvas. Hook is the first grey bubble (top 15%). 2-3 alternating bubbles answer it (middle 55%). Product shown as a small attached photo in the last bubble (bottom 20%).", suits: "a pain, a question, word of mouth", aliases: ["imessage", "text thread", "text message", "sms", "chat bubble"] },
  { name: "Tweet card", base: "graphic", layout: "Centered white post card on a solid brand-colour background (card 80% wide, 20-75% height). Hook as the post text, avatar + name top of card, product image attached inside the card, like/reply counts bottom.", suits: "opinions, bold claims, social proof", aliases: ["tweet", "x post", "twitter"] },
  { name: "Before and after split", base: "photo", layout: "Vertical split. Left 50% 'before' (dull, desaturated), right 50% 'after' with the product (bright). Hook across top 12%. Small labels at top of each half.", suits: "visible transformations", aliases: ["before and after", "before/after", "transformation"] },
  { name: "Product callouts", base: "graphic", layout: "Product centered at 55% height. Hook top 12%. 3-4 short callout labels with thin lines pointing to real features, left and right of the product.", suits: "products with several concrete features", aliases: ["callouts", "annotated product", "feature callouts"] },
  { name: "Timeline sequence", base: "graphic", layout: "Hook top 12%. Horizontal timeline at 45% height with 3-4 dated or numbered stops, each with a 2-4 word result. Product at the final stop, bottom right 25%.", suits: "results that build over time (day 1, week 2)", aliases: ["timeline", "day by day", "progress"] },
  { name: "UGC hand-held", base: "photo", layout: "Raw handheld phone photo of a hand holding the product toward the camera, casual and slightly off-centre. Hook as a short caption block in the top 20% over a calm area.", suits: "everyday products, trust, authenticity", aliases: ["ugc", "hand held", "handheld", "selfie style", "user generated"] },
  { name: "Comparison table", base: "graphic", layout: "Hook top 12%. Two-column table (3-5 rows) at 20-80%: 'us' column with ticks, 'them' column with crosses. Product small at bottom right 15%.", suits: "market with obvious alternatives", aliases: ["comparison", "versus", "vs", "us vs them"], needsCue: true },
  { name: "Review card", base: "graphic", layout: "Large 5-star row top 10%. A real customer quote as the hook in big type (20-60%). Reviewer name + 'verified' tag at 65%. Product at bottom 25%.", suits: "products with strong real reviews", aliases: ["review card", "testimonial card", "review"], needsCue: true },
  { name: "Offer badge", base: "graphic", layout: "Product centered at 55% height. Large round badge with the offer overlapping the product's top right corner (top 20-40%). Hook top 12%. Short urgency line bottom 8%.", suits: "real discounts and launches", aliases: ["offer badge", "sale badge", "discount badge", "sale", "offer"], needsCue: true },
  { name: "Notes app list", base: "graphic", layout: "Phone notes screen on a warm background. Hook as the note title (top 15%), 4-5 checklist lines below (20-70%), one line ticked. Product peeking in at bottom right.", suits: "lists, reasons, routines", aliases: ["notes app", "note list", "checklist"] },
  { name: "Search bar", base: "graphic", layout: "Search box top 15% with the hook typed in as the query. Below it 2 result cards (25-75%), the first one is the product with stars and a one-line benefit.", suits: "problem-aware people searching for a fix", aliases: ["search bar", "google search", "search result"] },
  { name: "Lock screen notification", base: "photo", layout: "Phone lock screen wallpaper (a calm scene) full bleed. Large clock top 12%. Notification stack at 30-50% with the hook as the message. Product photo as the wallpaper subject at bottom.", suits: "urgency, reminders, timing", aliases: ["lock screen", "notification"] },
  { name: "Cross-out list", base: "graphic", layout: "Hook top 12%. Vertical list of 3-4 common alternatives, each struck through (20-60%). Product large at bottom 35% with a tick.", suits: "replacing a habit or category", aliases: ["cross out", "crossed out", "strikethrough"] },
  { name: "Metaphor made literal", base: "photo", layout: "One striking staged scene that shows the benefit as a literal object (for example a cracked shield for weak protection). Hook top 12%, product bottom right 25%.", suits: "abstract benefits that are hard to show", aliases: ["metaphor", "visual metaphor", "literal"] },
  { name: "Stat-led", base: "graphic", layout: "One huge number or percentage centered at 35% height (taking 40% of the canvas). One-line meaning under it. Product bottom 30%.", suits: "only when the brand gave a real number", aliases: ["big number", "stat", "statistic"], needsCue: true },
  { name: "Customer quote close-up", base: "photo", layout: "Real-looking portrait of a customer filling the canvas. Quote as the hook in big type over the calmest area (60-85%). Small product shot bottom right.", suits: "emotional outcomes, identity", aliases: ["quote", "customer quote", "testimonial"], needsCue: true },
  { name: "Diagram explainer", base: "graphic", layout: "Hook top 12%. Simple 3-step flow or cross-section diagram at 25-75% with clear arrows and short labels. Product at the end of the flow.", suits: "how it works, unique mechanism", aliases: ["diagram", "how it works", "explainer", "infographic"] },
  { name: "Problem vs solution", base: "graphic", layout: "Top half 'problem' scene in muted colours with a short label; bottom half 'solution' with the product in brand colours. Hook runs across the dividing line at 50%.", suits: "clear single pain", aliases: ["problem solution", "problem vs solution"] },
  { name: "Flat lay", base: "photo", layout: "Top-down photo of the product with 4-6 related items arranged tidily on a textured surface. Hook as a small caption in the top 10%. Lots of breathing room.", suits: "kits, bundles, lifestyle products", aliases: ["flat lay", "flatlay", "top down"] },
  { name: "Big text only", base: "graphic", layout: "Solid brand-colour background. Hook huge across 20-65%, key words in an accent colour. Small product image bottom right 25%.", suits: "a strong line, bold brands", aliases: ["typographic", "text only", "big text", "type only"] },
  { name: "Open loop question", base: "graphic", layout: "Hook as a question in large type (top 15-40%). Product centered at 65% height. Answer teased in a small subline under the question.", suits: "curiosity, unaware audiences", aliases: ["question ad", "open loop"] },
  { name: "Ingredient breakdown", base: "graphic", layout: "Product centered at 50% height. 4-6 key ingredients or materials as small round photos around it, each with a 1-3 word benefit label. Hook top 12%.", suits: "ingredient or material led products", aliases: ["ingredients", "ingredient breakdown", "materials", "what's inside"] },
  { name: "Unboxing", base: "photo", layout: "Overhead photo of hands opening the box with the product visible inside. Hook as a short caption top 12%. Mess and wrapping left in on purpose.", suits: "gifts, premium packaging", aliases: ["unboxing", "unbox", "opening the box"] },
  { name: "Seasonal scene", base: "photo", layout: "Product in a real seasonal scene (holiday table, beach bag, back to school desk). Hook top-left 20% over a calm area. Season named in the hook.", suits: "real seasonal moments", aliases: ["seasonal", "holiday ad", "christmas", "black friday"], needsCue: true },
  { name: "Founder note", base: "photo", layout: "Photo of the founder or maker with the product, natural light. A handwritten-style note as the hook (60-90%), signed with first name.", suits: "small brands, trust, story", aliases: ["founder note", "founder story", "letter"] },
  { name: "Sticky note on product", base: "photo", layout: "Real product shot with a yellow sticky note stuck to it. The hook is handwritten on the note (30-60%). Everything else plain.", suits: "casual, honest tone", aliases: ["sticky note", "post it", "post-it"] },
  { name: "Screen split three ways", base: "graphic", layout: "Canvas in three equal vertical panels, each one a photo of a different use or person. Hook across the top 12%. Product in the centre panel bottom 25%.", suits: "products for several types of people", aliases: ["three panels", "triptych", "split screen"] },
  { name: "Ranking chart", base: "graphic", layout: "Hook top 12%. Horizontal bar chart at 25-70% with 3-4 bars, ours longest, labelled with a real measure. Product bottom right 20%.", suits: "only with a real measured advantage", aliases: ["bar chart", "ranking", "chart"], needsCue: true },
  { name: "Energy curve", base: "graphic", layout: "Hook top 12%. Line graph at 25-65%: a jagged line for 'without' and a smooth steady line for 'with'. Product bottom 25%.", suits: "steady results vs ups and downs", aliases: ["curve", "graph", "line graph"] },
  { name: "Process steps", base: "graphic", layout: "Hook top 12%. 3 numbered steps in a row at 30-65%, each a small image and a 3-5 word label. Product at the end bottom right.", suits: "routines, easy use", aliases: ["steps", "3 steps", "process", "routine"], needsCue: true },
  { name: "Hand-drawn doodle overlay", base: "photo", layout: "Real photo with hand-drawn arrows and circles pointing at 2-3 details. Hook scribbled across the top 15%.", suits: "details people miss", aliases: ["doodle", "hand drawn", "scribble", "annotated photo"] },
  { name: "Pill list", base: "graphic", layout: "Product centered at 50% height. Hook top 12%. 5-6 rounded pills with short benefits scattered around the product, none overlapping it.", suits: "many small benefits", aliases: ["pills", "benefit pills", "tags"] },
  { name: "Neon night shot", base: "photo", layout: "Product lit by one strong coloured light in a dark scene. Hook in clean white type bottom 25%.", suits: "bold, young, premium", aliases: ["neon", "night", "dark mode"] },
  { name: "Giant product", base: "graphic", layout: "Product enlarged to fill 75% of the canvas, cropped at the edges. Hook small at top 10%, subline bottom 8%.", suits: "beautiful, well-known looking products", aliases: ["giant product", "close up", "hero crop"] },
  { name: "Person with product", base: "photo", layout: "Real-looking person using the product in an everyday moment, framed waist-up. Hook top 15% over calm area. Product clearly visible in hand or in use.", suits: "lifestyle, identity", aliases: ["person with product", "lifestyle photo", "in use"] },
  { name: "Polaroid memory", base: "photo", layout: "Polaroid-style photo tilted slightly on a plain surface (20-75%) showing the product in a real moment. Hook handwritten on the white border under the photo. Small product shot bottom right.", suits: "gifts, memories, warm brands", aliases: ["polaroid", "memory ad"] },
  { name: "FAQ card", base: "graphic", layout: "Hook is the question everyone asks (top 15%). Answer as 2-3 short lines (20-55%). Product at bottom 40% with a 'yes' tick.", suits: "objections", aliases: ["faq", "objection ad", "common question"] },
];

// Formats whose visual idea still works when ALL the text sits in one block at a spot the user fixed
// (the composition setting). The structured ones (phone screens, tables, charts, timelines...) do not.
const BLOCK_OK = new Set([
  "UGC hand-held", "Metaphor made literal", "Customer quote close-up", "Flat lay", "Unboxing", "Seasonal scene", "Founder note",
  "Sticky note on product", "Neon night shot", "Giant product", "Person with product", "Polaroid memory", "Product callouts",
  "Offer badge", "Pill list", "Open loop question", "Hand-drawn doodle overlay", "Ingredient breakdown",
]);
export const worksWithTextBlock = (f: AdFormat) => BLOCK_OK.has(f.name);

// The words that mark "I am naming a format" for the generic-sounding names.
const CUE = /\b(as an?|like an?|in the style of|style of|format|layout|using an?)\b/i;

/** The user named a format ("as an iMessage", "before and after"): use exactly that one. */
export function namedFormat(text: string): AdFormat | null {
  const t = text.toLowerCase();
  const cued = CUE.test(t);
  let best: { f: AdFormat; len: number } | null = null;
  for (const f of AD_FORMATS) {
    for (const a of [f.name.toLowerCase(), ...(f.aliases || [])]) {
      const esc = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`);
      // generic words count only with a cue ("as a", "format"...) or when directly followed by post/ad/card/style ("comparison post")
      if (f.needsCue && !cued && !new RegExp(`(^|[^a-z])${esc}\\s+(post|posts|ad|ads|card|cards|format|layout|style|template)([^a-z]|$)`).test(t)) continue;
      if (re.test(t) && (!best || a.length > best.len)) best = { f, len: a.length };
    }
  }
  return best ? best.f : null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seeded<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A repeatable shortlist: skips formats already used in this chat, mixes graphic and photo. */
export function candidateFormats(opts: { previous: string[]; hasProductPhoto: boolean; seed: string; count?: number; textBlockOnly?: boolean }): AdFormat[] {
  const count = opts.count || 8;
  const used = opts.previous.join(" | ").toLowerCase();
  const all = opts.textBlockOnly ? AD_FORMATS.filter(worksWithTextBlock) : AD_FORMATS;
  const fresh = all.filter((f) => !used.includes(f.name.toLowerCase()));
  const pool = seeded(fresh.length >= count ? fresh : all, hash(opts.seed));
  const want = opts.hasProductPhoto ? ["graphic", "photo"] : ["photo", "graphic"];
  const out: AdFormat[] = [];
  for (let i = 0; out.length < count && i < pool.length * 2; i++) {
    const wantBase = want[out.length % 2];
    const hit = pool.find((f) => f.base === wantBase && !out.includes(f)) || pool.find((f) => !out.includes(f));
    if (!hit) break;
    out.push(hit);
  }
  return out;
}

export function formatLine(f: AdFormat): string {
  return `${f.name} (${f.base}-led): ${f.layout} Suits: ${f.suits}.`;
}

export function formatLibraryBlock(list: AdFormat[]): string {
  return list.map((f, i) => `   ${i + 1}. ${formatLine(f)}`).join("\n");
}

// ---------- hook writing styles ----------
export const HOOK_STYLES = [
  "observational", "rhetorical question", "conditional", "affirmative", "contrarian", "confessional", "imperative", "comparative",
  "hypothetical", "provocative", "testimonial", "declarative", "conversational", "cautionary", "reframe", "negation stack", "POV",
  "anecdotal", "stat-led", "definitional", "quoted", "permission-granting", "threshold", "direct address",
];

/** Six styles to choose from, different each ad, skipping any the chat already used in its Concept lines. */
export function candidateStyles(previous: string[], seed: string): string[] {
  const used = previous.join(" | ").toLowerCase();
  const fresh = HOOK_STYLES.filter((s) => !used.includes(s.toLowerCase()));
  return seeded(fresh.length >= 6 ? fresh : HOOK_STYLES, hash(seed + "styles")).slice(0, 6);
}
