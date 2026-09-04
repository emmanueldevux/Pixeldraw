// ============================================================
// UXLLY — Logo Compositor
// The logo must NEVER pass through the generative model — no
// images.edit call, no vision "redraw it in this style" prompt.
// It gets resized (proportionally, no distortion) and pasted
// pixel-exact onto the finished generation with sharp, the same
// way a design tool would place a layer. What goes in is what
// comes out, just repositioned and scaled.
// ============================================================

import sharp from "sharp";

export type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

// ==================== Automatic Placement ====================
// Used when a brand hasn't explicitly locked in a fixed logo position —
// picks a corner with sensible weighting (corners favored over dead-
// center, which tends to collide with the main subject) and a scale
// appropriate to that slot, so the logo doesn't land in the same spot
// on every single generation.

export interface LogoPlacement {
  position: LogoPosition;
  scale: number;
}

const AUTO_POSITIONS: { position: LogoPosition; weight: number; scale: number }[] = [
  { position: "bottom-right", weight: 3, scale: 0.14 },
  { position: "top-left", weight: 3, scale: 0.13 },
  { position: "bottom-left", weight: 2, scale: 0.14 },
  { position: "top-right", weight: 2, scale: 0.13 },
  { position: "center", weight: 1, scale: 0.1 }, // rare — only when it genuinely fits
];

export function pickLogoPlacement(): LogoPlacement {
  const totalWeight = AUTO_POSITIONS.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const p of AUTO_POSITIONS) {
    if (roll < p.weight) return { position: p.position, scale: p.scale };
    roll -= p.weight;
  }
  return { position: "bottom-right", scale: 0.14 }; // fallback, should never hit
}

// ==================== Load Buffer (data URL or http URL) ====================

async function loadImageBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) {
    const base64 = src.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64, "base64");
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ==================== Composite Logo ====================

export async function compositeLogo(
  generatedImageSrc: string,
  logoSrc: string,
  position: LogoPosition = "bottom-right",
  scale: number = 0.14
): Promise<string> {
  const [genBuffer, logoBuffer] = await Promise.all([
    loadImageBuffer(generatedImageSrc),
    loadImageBuffer(logoSrc),
  ]);

  const genMeta = await sharp(genBuffer).metadata();
  const canvasW = genMeta.width || 1024;
  const canvasH = genMeta.height || 1024;

  // Resize proportionally (fit: "inside" preserves aspect ratio — never
  // stretched/distorted) to a target width, height following naturally.
  const targetLogoW = Math.max(1, Math.round(canvasW * scale));
  const resizedLogo = await sharp(logoBuffer)
    .resize({ width: targetLogoW, fit: "inside" })
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const logoW = logoMeta.width || targetLogoW;
  const logoH = logoMeta.height || targetLogoW;

  const padding = Math.round(canvasW * 0.035);

  let left = padding;
  let top = padding;

  switch (position) {
    case "top-right":
      left = canvasW - logoW - padding;
      top = padding;
      break;
    case "bottom-left":
      left = padding;
      top = canvasH - logoH - padding;
      break;
    case "bottom-right":
      left = canvasW - logoW - padding;
      top = canvasH - logoH - padding;
      break;
    case "center":
      left = Math.round((canvasW - logoW) / 2);
      top = Math.round((canvasH - logoH) / 2);
      break;
    case "top-left":
    default:
      left = padding;
      top = padding;
      break;
  }

  // Clamp so the logo never gets placed partially off-canvas
  left = Math.max(0, Math.min(left, canvasW - logoW));
  top = Math.max(0, Math.min(top, canvasH - logoH));

  const composited = await sharp(genBuffer)
    .composite([{ input: resizedLogo, left, top }])
    .png()
    .toBuffer();

  return `data:image/png;base64,${composited.toString("base64")}`;
}
