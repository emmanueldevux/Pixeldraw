// ============================================================
// UXLLY — Slide text overlay
// Draws caption text on top of a clean background image using real
// web fonts on a canvas. The live preview and the download both use
// drawSlide(), so what you see is what you export.
// ============================================================

export type CaptionStyle = "plain" | "box" | "outline";
export type TextPosition = "top" | "center" | "bottom";

export interface SlideTextLayer {
  text: string;
  position: TextPosition;
}

export interface OverlayStyle {
  fontFamily: string;
  color: string;
  sizePct: number; // font size as a % of image width
  captionStyle: CaptionStyle;
}

export const OVERLAY_FONTS = [
  "Montserrat",
  "Inter",
  "Poppins",
  "Oswald",
  "Anton",
  "Playfair Display",
];

export const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  fontFamily: "Montserrat",
  color: "#FFFFFF",
  sizePct: 6,
  captionStyle: "outline",
};

export function fontsStylesheetUrl(): string {
  const families = OVERLAY_FONTS.map(
    (f) => `family=${encodeURIComponent(f)}:wght@400;700;800`
  ).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed so the canvas stays readable for export. Hosts that don't send
    // CORS headers will fail here instead of silently breaking the download.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = url;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/** Draws the image and the caption onto the canvas at the image's native size. */
export async function drawSlide(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  layer: SlideTextLayer,
  style: OverlayStyle
): Promise<void> {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(img, 0, 0, width, height);

  const text = layer.text.trim();
  if (!text) return;

  const fontSize = Math.round((style.sizePct / 100) * width);

  // Wait for the chosen font so the first draw doesn't fall back to a default.
  try {
    await document.fonts.load(`800 ${fontSize}px "${style.fontFamily}"`);
  } catch {
    // Fall through to the fallback family below.
  }

  ctx.font = `800 ${fontSize}px "${style.fontFamily}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const lines = wrapLines(ctx, text, width * 0.82);
  const lineHeight = fontSize * 1.22;
  const blockHeight = lines.length * lineHeight;
  const top =
    layer.position === "top"
      ? height * 0.12
      : layer.position === "bottom"
        ? height * 0.88 - blockHeight
        : (height - blockHeight) / 2;
  const cx = width / 2;

  if (style.captionStyle === "box") {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const pad = fontSize * 0.35;
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(cx - widest / 2 - pad, top - pad * 0.6, widest + pad * 2, blockHeight + pad * 1.2);
  }

  // Plain captions get a soft shadow for legibility; outline captions get a stroke.
  ctx.shadowColor = style.captionStyle === "plain" ? "rgba(0,0,0,0.6)" : "transparent";
  ctx.shadowBlur = style.captionStyle === "plain" ? fontSize * 0.3 : 0;
  ctx.shadowOffsetY = style.captionStyle === "plain" ? fontSize * 0.08 : 0;

  lines.forEach((line, i) => {
    const y = top + i * lineHeight;
    if (style.captionStyle === "outline") {
      ctx.lineJoin = "round";
      ctx.lineWidth = fontSize * 0.14;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(line, cx, y);
    }
    ctx.fillStyle = style.color;
    ctx.fillText(line, cx, y);
  });

  ctx.shadowColor = "transparent";
}
