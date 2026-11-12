// ============================================================
// UXLLY — Lifestyle slideshows (TikTok photo mode): shared types
// ============================================================

export type SlideshowFormat = "list" | "story" | "travel" | "split";
export type SlideshowAspect = "3:4" | "9:16";
export type CaptionLook = "white" | "dark" | "plain";

export const FORMATS: { key: SlideshowFormat; name: string; hint: string }[] = [
  { key: "list", name: "Hook + list", hint: "A hook photo, then numbered tips with short notes, then a closer" },
  { key: "story", name: "Story / day in the life", hint: "One person moving through a story, one moment per slide" },
  { key: "travel", name: "Travel", hint: "One place or trip: spots, moments and tips" },
  { key: "split", name: "2-in-1 stacked", hint: "Two photos stacked top and bottom, a line on each (before/after, this/that)" },
];

/** Final export sizes (the AI renders 1024x1536, we crop to the shape and enlarge). */
export const ASPECT_PX: Record<SlideshowAspect, { w: number; h: number; ratio: number }> = {
  "3:4": { w: 2160, h: 2880, ratio: 3 / 4 },
  "9:16": { w: 2160, h: 3840, ratio: 9 / 16 },
};
/** Half of a 2-in-1 slide: always 3:2 landscape. */
export const HALF_PX = { w: 2160, h: 1440 };

export interface Character {
  id: string;
  name: string;
  description: string;
  photos: string[]; // 1-4 urls
  source: "upload" | "ai";
}

export interface PlannedSlide {
  n: number;
  kind: "single" | "split";
  scene: string; // photo description (top half for split)
  scene2: string; // bottom half for split
  text: string; // main caption
  detail: string; // optional short follow-up lines (list format)
  text2: string; // bottom caption for split
  person: "character" | "anonymous" | "none";
}

export interface SlideshowPlan {
  title: string;
  slides: PlannedSlide[];
}

export interface SlideshowStyleRec {
  id: string;
  name: string;
  description: string;
  refs: string[];
  dna: string;
  textStyle: CaptionLook;
  formats: string[];
  published: boolean;
  sortOrder: number;
  usageCount: number;
  ownerId?: string | null;
}

const s = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v : []);

export function cleanStyleInput(raw: Record<string, unknown>) {
  return {
    name: s(raw.name, 80).trim() || "Untitled style",
    description: s(raw.description, 400).trim(),
    refs: list(raw.refs).map((u) => s(u, 3000)).filter((u) => u.length > 8).slice(0, 12),
    dna: s(raw.dna, 6000),
    textStyle: (["white", "dark", "plain"] as const).includes(raw.textStyle as CaptionLook) ? (raw.textStyle as CaptionLook) : ("white" as const),
    formats: list(raw.formats).map((f) => s(f, 12)).filter((f) => ["list", "story", "travel", "split"].includes(f)),
    published: raw.published === true,
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Math.round(Number(raw.sortOrder)) : 0,
  };
}

export function cleanCharacters(v: unknown): Character[] {
  return list(v)
    .map((c) => {
      const o = (c || {}) as Record<string, unknown>;
      return {
        id: s(o.id, 40) || `c${Math.random().toString(36).slice(2, 8)}`,
        name: s(o.name, 60).trim() || "Character",
        description: s(o.description, 800).trim(),
        photos: list(o.photos).map((u) => s(u, 3000)).filter((u) => u.length > 8).slice(0, 4),
        source: (o.source === "ai" ? "ai" : "upload") as "ai" | "upload",
      };
    })
    .filter((c) => c.photos.length > 0)
    .slice(0, 6);
}
