// ============================================================
// UXLLY — Composition (single ads only)
// Where the ad's TEXT BLOCK sits on the canvas. The logo always follows it:
// it goes directly above the text block, same alignment, with padding below.
//   - the image model is told exactly where the text block goes and to leave a
//     clean empty band above it (it never draws the logo);
//   - then the real logo is pasted pixel-exact into that band with sharp.
// "auto" = the old behaviour (nothing here runs).
// ============================================================
import sharp from "sharp";

export type CompositionSpot = "top-left" | "top-middle" | "top-right" | "center" | "bottom-left" | "bottom-middle" | "bottom-right";
export type Composition = "auto" | CompositionSpot;

export const COMPOSITION_SPOTS: CompositionSpot[] = ["top-left", "top-middle", "top-right", "center", "bottom-left", "bottom-middle", "bottom-right"];

export function parseComposition(v: unknown): Composition {
  return typeof v === "string" && (COMPOSITION_SPOTS as string[]).includes(v) ? (v as CompositionSpot) : "auto";
}

interface Geom {
  align: "left" | "center" | "right";
  x0: number;
  x1: number;
  blockTop: number;
  blockBottom: number;
  bandTop: number;
  bandBottom: number;
  zone: string;
}

const MARGIN = 0.06; // side margin (fraction of width)
const BAND_H = 0.09; // empty band reserved for the logo (fraction of height)

function geom(spot: CompositionSpot, hasLogo: boolean): Geom {
  const [row, col] = spot === "center" ? ["center", "middle"] : (spot.split("-") as [string, string]);
  const align = col === "left" ? "left" : col === "right" ? "right" : "center";
  const x0 = col === "left" ? MARGIN : col === "right" ? 0.4 : 0.2;
  const x1 = col === "left" ? 0.6 : col === "right" ? 1 - MARGIN : 0.8;
  const blockH = 0.26;
  let blockTop: number;
  if (row === "top") blockTop = hasLogo ? 0.04 + BAND_H + 0.015 : 0.06;
  else if (row === "bottom") blockTop = 0.94 - blockH;
  else blockTop = 0.5 - blockH / 2;
  const blockBottom = blockTop + blockH;
  const bandBottom = blockTop - 0.015;
  const bandTop = bandBottom - BAND_H;
  const zone = `${row === "center" ? "vertical middle" : row} ${col === "middle" ? "centre" : col === "center" ? "" : col}`.replace(/\s+/g, " ").trim();
  return { align, x0, x1, blockTop, blockBottom, bandTop, bandBottom, zone };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The instruction block for the image model. Empty for "auto". */
export function compositionDirective(c: Composition, hasLogo: boolean): string {
  if (c === "auto") return "";
  const g = geom(c, hasLogo);
  return [
    "COMPOSITION (fixed by the user: it OVERRIDES any layout, text position or alignment in the reference, but keep the reference's style, colours, type character and finish):",
    `- Put ALL text (headline and supporting text) together in ONE compact block, ${g.align}-aligned, in the ${g.zone} area: the block spans about ${pct(g.blockTop)} to ${pct(g.blockBottom)} of the canvas height and ${pct(g.x0)} to ${pct(g.x1)} of its width.`,
    hasLogo
      ? `- Leave a clean, completely empty band about ${pct(BAND_H)} tall, from ${pct(g.bandTop)} to ${pct(g.bandBottom)} of the height, directly above the text block and ${g.align}-aligned with it, filled with the same background as the area around it. A brand logo is added there later: draw NO logo, mark, icon, text or placeholder in that band.`
      : "",
    "- The product or main visual fills the rest of the canvas and must not overlap the text block or the empty band.",
    "- Never put text anywhere else. Keep the block balanced, legible, with generous breathing room.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function loadBuf(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) return Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Paste the real logo into the reserved band: just above the text block, same alignment. */
export async function compositeLogoForComposition(imageSrc: string, logoSrc: string, c: CompositionSpot, scale = 0.14): Promise<string> {
  const [base, logo] = await Promise.all([loadBuf(imageSrc), loadBuf(logoSrc)]);
  const meta = await sharp(base).metadata();
  const W = meta.width || 1080;
  const H = meta.height || 1350;
  const g = geom(c, true);

  const maxW = Math.max(1, Math.round(W * Math.min(Math.max(scale, 0.06), 0.4)));
  const maxH = Math.max(1, Math.round(H * (BAND_H - 0.012)));
  const resized = await sharp(logo).resize({ width: maxW, height: maxH, fit: "inside" }).toBuffer();
  const lm = await sharp(resized).metadata();
  const lw = lm.width || maxW;
  const lh = lm.height || maxH;

  const margin = Math.round(W * MARGIN);
  const left = g.align === "left" ? margin : g.align === "right" ? W - lw - margin : Math.round((W - lw) / 2);
  const top = Math.round(g.bandBottom * H - lh); // sits at the bottom of the band: padding below, text under it

  const out = await sharp(base)
    .composite([{ input: resized, left: Math.max(0, Math.min(left, W - lw)), top: Math.max(0, Math.min(top, H - lh)) }])
    .png()
    .toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}
