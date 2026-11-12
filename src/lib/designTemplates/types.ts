// ============================================================
// UXLLY — Design templates ("prompt recipes")
//
// A design template is an art-director recipe, not an image:
//   - prompt: the full instruction, with [[Param Name]] placeholders
//   - params: what each placeholder means, its default text, and
//             whether users may fill it in when they use the template
//   - styles: a menu of ad styles. [[STYLES]] in the prompt becomes
//             either "pick the best one of these" (auto) or the one
//             style the user chose.
//   - [[BRAND_COLOURS]] is filled by the system: the picked project's
//             brand colours, or a fallback when there are none.
// Admins edit all of this in /admin → Templates.
// ============================================================

export interface TemplateParam {
  key: string; // exactly the text inside [[ ]] in the prompt, e.g. "Headline"
  defaultValue: string; // used when the user leaves it empty
  userEditable: boolean; // show a field for it on the "Use template" screen
  userLabel: string; // e.g. "Headline (optional)"
  userPlaceholder: string;
  wrap: string; // how the user's text is phrased in the prompt; {value} = their text. Empty = use as-is
}

export interface TemplateStyle {
  key: string; // "A"
  name: string; // "COLOUR-BLOCK ARC"
  description: string;
  bestFor: string;
}

export type TemplateKind = "prompt" | "pack";

export interface DesignTemplate {
  id: string;
  number: number;
  /** "prompt" = written recipe (Templates 1-3); "pack" = reference ads + studied DNA */
  kind: TemplateKind;
  /** pack: the reference ads (1+) */
  refImages: string[];
  /** pack: the shared DNA of all reference ads */
  packDna: string;
  /** pack: one short DNA per reference ad (same order as refImages), incl. what it suits best */
  refDnas: string[];
  title: string;
  description: string;
  category: string;
  tags: string[];
  aspect: "9:16" | "4:5" | "1:1" | "16:9";
  coverImages: string[];
  prompt: string;
  params: TemplateParam[];
  styles: TemplateStyle[];
  needsProduct: boolean;
  useBrandBrain: boolean;
  published: boolean;
  sortOrder: number;
  usageCount: number;
  /** set = a user's own private pack */
  ownerId?: string | null;
}

/** Public shape for the templates page (no prompt text: that's our IP). */
export type PublicTemplate = Omit<DesignTemplate, "prompt" | "params" | "packDna" | "refDnas"> & {
  fields: { key: string; label: string; placeholder: string }[];
};

/** A reference pack for thumbnails (kept apart from ad packs by its category). */
export const isThumbPack = (t: { category?: string | null }) => (t.category || "").trim().toLowerCase() === "thumbnails";

export const ASPECTS = ["9:16", "4:5", "1:1", "16:9"] as const;
/** Placeholders the system fills itself; admins don't define params for these. */
export const RESERVED = ["STYLES", "BRAND_COLOURS"];

export const NO_BRAND_COLOURS = "use the pack's main colour, a deeper shade of it and one contrasting accent";

export function brandColoursText(c: { primary?: string | null; secondary?: string | null; accent?: string | null; background?: string | null }): string | null {
  if (!c.primary && !c.accent) return null;
  const parts = [
    c.primary && `primary ${c.primary} (the dominant colour: background or the main colour panels)`,
    c.accent && `accent ${c.accent} (headline highlight, icons, one accent line)`,
    c.secondary && `secondary ${c.secondary} (text and small details)`,
    c.background && `background ${c.background}`,
  ].filter(Boolean);
  return `use the brand's colours exactly: ${parts.join(", ")}. Do not recolour the product or its pack; it keeps its real colours`;
}
export const ASPECT_TO_SIZE: Record<DesignTemplate["aspect"], string> = {
  "9:16": "1080x1920",
  "4:5": "1000x1500",
  "1:1": "1080x1080",
  "16:9": "1920x1080",
};

// ==================== Cleaning (admin input) ====================

const s = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

export function cleanTemplateInput(raw: Record<string, unknown>) {
  const aspect = (ASPECTS as readonly string[]).includes(raw.aspect as string) ? (raw.aspect as DesignTemplate["aspect"]) : "9:16";
  return {
    title: s(raw.title, 120).trim() || "Untitled template",
    description: s(raw.description, 600).trim(),
    category: s(raw.category, 60).trim(),
    tags: arr(raw.tags).map((t) => s(t, 40).trim()).filter(Boolean).slice(0, 15),
    aspect,
    coverImages: arr(raw.coverImages).map((u) => s(u, 3_000_000)).filter(Boolean).slice(0, 8),
    prompt: s(raw.prompt, 20000),
    params: arr(raw.params)
      .map((p) => {
        const o = (p || {}) as Record<string, unknown>;
        return {
          key: s(o.key, 60).trim(),
          defaultValue: s(o.defaultValue, 1000),
          userEditable: o.userEditable === true,
          userLabel: s(o.userLabel, 80),
          userPlaceholder: s(o.userPlaceholder, 160),
          wrap: s(o.wrap, 400),
        };
      })
      .filter((p) => p.key && !RESERVED.includes(p.key.toUpperCase()))
      .slice(0, 20),
    styles: arr(raw.styles)
      .map((p) => {
        const o = (p || {}) as Record<string, unknown>;
        return { key: s(o.key, 4).trim().toUpperCase(), name: s(o.name, 80).trim(), description: s(o.description, 800).trim(), bestFor: s(o.bestFor, 200).trim() };
      })
      .filter((x) => x.key && x.name)
      .slice(0, 26),
    kind: raw.kind === "pack" ? ("pack" as const) : ("prompt" as const),
    refImages: arr(raw.refImages).map((u) => s(u, 3_000_000)).filter(Boolean).slice(0, 12),
    packDna: s(raw.packDna, 8000),
    refDnas: arr(raw.refDnas).map((u) => s(u, 2000)).slice(0, 12),
    needsProduct: raw.needsProduct === undefined ? raw.kind !== "pack" : raw.needsProduct === true,
    useBrandBrain: raw.useBrandBrain !== false,
    published: raw.published === true,
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Math.round(Number(raw.sortOrder)) : 0,
  };
}

// ==================== Building the final prompt ====================

/** User fields every reference pack offers. */
export const PACK_FIELDS = [
  { key: "Brief", label: "What's the ad for?", placeholder: "e.g. Weekend sale on all sneakers, 20% off" },
  { key: "Headline", label: "Headline (optional)", placeholder: "Leave empty and the AI writes one" },
];

export function toPublic(t: DesignTemplate): PublicTemplate {
  const { prompt: _p, params, packDna: _d, refDnas: _r, ...rest } = t;
  void _p;
  void _d;
  void _r;
  return {
    ...rest,
    coverImages: rest.coverImages.length ? rest.coverImages : rest.kind === "pack" ? rest.refImages.slice(0, 4) : [],
    fields:
      t.kind === "pack"
        ? PACK_FIELDS
        : params.filter((p) => p.userEditable).map((p) => ({ key: p.key, label: p.userLabel || p.key, placeholder: p.userPlaceholder })),
  };
}

function styleLine(st: TemplateStyle) {
  return `${st.key}) ${st.name}: ${st.description}${st.bestFor ? ` Best for ${st.bestFor}.` : ""}`;
}

/**
 * Fill the recipe.
 * values: user text per param key (only userEditable params are honoured)
 * styleKey: a style's key to force, or null to let the AI pick
 * brandNote: optional brand-voice block appended at the end
 */
export function renderPrompt(
  t: Pick<DesignTemplate, "prompt" | "params" | "styles">,
  values: Record<string, string>,
  styleKey: string | null,
  brandNote?: string,
  brandColours?: string | null,
): string {
  let out = t.prompt;
  for (const p of t.params) {
    const user = p.userEditable ? (values[p.key] || "").trim().slice(0, 300) : "";
    const text = user ? (p.wrap ? p.wrap.split("{value}").join(user) : user) : p.defaultValue;
    out = out.split(`[[${p.key}]]`).join(text);
  }
  const forced = styleKey ? t.styles.find((x) => x.key === styleKey) : null;
  const stylesText = forced
    ? `Build the whole ad in this style:\n${styleLine(forced)}`
    : t.styles.length
      ? `Choose the ONE style below that fits the product best, then build the whole ad in it:\n${t.styles.map(styleLine).join("\n")}`
      : "";
  out = out.split("[[STYLES]]").join(stylesText);
  out = out.split("[[BRAND_COLOURS]]").join(brandColours || NO_BRAND_COLOURS);
  // Any placeholder the admin forgot to define should not leak into the image.
  out = out.replace(/\[\[[^\]]+\]\]/g, "");
  if (brandNote) out += `\n\n${brandNote}`;
  return out.trim();
}

/** Placeholders used in the prompt that have no param yet (shown as a warning in admin). */
export function missingParams(prompt: string, params: TemplateParam[]): string[] {
  const used = Array.from(new Set(Array.from(prompt.matchAll(/\[\[([^\]]+)\]\]/g)).map((m) => m[1])));
  return used.filter((k) => !RESERVED.includes(k) && !params.some((p) => p.key === k));
}
