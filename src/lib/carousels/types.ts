// ============================================================
// UXLLY — Carousel styles (Intro / Details / Outro)
//
// A carousel style is a reusable look made by the admin from reference
// slides, in three slots:
//   intro   — slide 1, the scroll stopper
//   details — slides 2..N-1, all share ONE layout; only text + visual change
//   outro   — the last slide, the call to action
// Each slot has reference images and a written "DNA" (the AI's study of
// those references, editable in admin). Each project picks one style in
// Project settings, so a page's carousels always look consistent.
// ============================================================

export type SlotKey = "intro" | "details" | "outro";
export const SLOTS: SlotKey[] = ["intro", "details", "outro"];
export const SLOT_LABEL: Record<SlotKey, string> = { intro: "Intro (slide 1)", details: "Details (middle slides)", outro: "Outro (last slide)" };

export interface CarouselStyle {
  id: string;
  name: string;
  description: string;
  published: boolean;
  sortOrder: number;
  introRefs: string[];
  introDna: string;
  detailsRefs: string[];
  detailsDna: string;
  outroRefs: string[];
  outroDna: string;
  usageCount: number;
  ownerId?: string | null;
}

export const refsKey = (s: SlotKey) => `${s}Refs` as const;
export const dnaKey = (s: SlotKey) => `${s}Dna` as const;

export type CarouselSize = "4:5" | "1:1" | "9:16";
export const CAROUSEL_SIZES: CarouselSize[] = ["4:5", "1:1", "9:16"];

/** Per-project carousel settings, stored in StyleGuide.advancedSettings.carousel */
export interface ProjectCarouselSettings {
  styleId: string;
  authorName: string;
  handle: string;
}
export const EMPTY_PROJECT_CAROUSEL: ProjectCarouselSettings = { styleId: "", authorName: "", handle: "" };

export function readProjectCarousel(advancedSettings: unknown): ProjectCarouselSettings {
  const c = (advancedSettings as { carousel?: Partial<ProjectCarouselSettings> } | null)?.carousel || {};
  return {
    styleId: typeof c.styleId === "string" ? c.styleId : "",
    authorName: typeof c.authorName === "string" ? c.authorName.slice(0, 60) : "",
    handle: typeof c.handle === "string" ? c.handle.replace(/^@+/, "").slice(0, 40) : "",
  };
}

/** A user image the chat attached for a specific slide. */
export interface SlideImage {
  target: "intro" | "outro" | "details" | number; // number = 1-based slide index
  dataUrl: string;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x).slice(0, 12) : []);

export function cleanStyleInput(raw: Record<string, unknown>) {
  return {
    name: s(raw.name, 80).trim() || "Untitled style",
    description: s(raw.description, 400).trim(),
    published: raw.published === true,
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Math.round(Number(raw.sortOrder)) : 0,
    introRefs: list(raw.introRefs),
    introDna: s(raw.introDna, 8000),
    detailsRefs: list(raw.detailsRefs),
    detailsDna: s(raw.detailsDna, 8000),
    outroRefs: list(raw.outroRefs),
    outroDna: s(raw.outroDna, 8000),
  };
}

/** A style can be used once every slot has at least one reference. */
export function isUsable(st: Pick<CarouselStyle, "introRefs" | "detailsRefs" | "outroRefs">) {
  return st.introRefs.length > 0 && st.detailsRefs.length > 0 && st.outroRefs.length > 0;
}
