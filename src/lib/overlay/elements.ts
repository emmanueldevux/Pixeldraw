// ============================================================
// UXLLY — Slide layout elements
// Every slide is a set of editable elements placed inside bounding
// boxes: text blocks (H1, H2, paragraph, bullet) and the logo.
// The AI plans where each box goes; the editor owns the copy and the
// box positions. The live preview and the download both use
// drawSlideLayout(), so what you see is what you export.
// ============================================================

import { loadImage } from "@/lib/overlay/slideText";

// Box in fractions of the image (0–1), origin at the top-left.
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TextKind = "h1" | "h2" | "p" | "bullet";
export type TextAlign = "left" | "center" | "right";

export interface TextStyle {
  fontFamily: string;
  color: string;
  sizePct: number; // H1 font size as a % of image width; other kinds scale from it
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: TextAlign;
  lineSpacing: number; // line height multiplier
  bg?: "none" | "white" | "dark"; // TikTok-style caption box behind each line
}

export interface TextElement {
  id: string;
  kind: TextKind;
  text: string;
  box: Box;
  style: TextStyle;
}

export interface LogoElement {
  src: string;
  box: Box;
}

export interface SlideLayout {
  texts: TextElement[];
  logo: LogoElement | null;
}

export const OVERLAY_FONTS = ["Montserrat", "Inter", "Poppins", "Oswald", "Anton", "Playfair Display"];

export const KIND_SCALE: Record<TextKind, number> = { h1: 1, h2: 0.62, p: 0.42, bullet: 0.42 };
export const KIND_LABEL: Record<TextKind, string> = { h1: "H1", h2: "H2", p: "Paragraph", bullet: "Bullet list" };

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Montserrat",
  color: "#FFFFFF",
  sizePct: 7,
  bold: true,
  italic: false,
  underline: false,
  strike: false,
  align: "center",
  lineSpacing: 1.2,
};

// Default style per kind, so a new H2 or paragraph doesn't inherit the H1 weight.
export function defaultStyleFor(kind: TextKind, base: TextStyle = DEFAULT_TEXT_STYLE): TextStyle {
  return {
    ...base,
    bold: kind === "h1" || kind === "h2",
    italic: false,
    underline: false,
    strike: false,
  };
}

// ==================== Boxes ====================

export function clampBox(raw: Partial<Box> | null | undefined, fallback: Box): Box {
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const w = Math.min(1, Math.max(0.05, num(raw?.w, fallback.w)));
  const h = Math.min(1, Math.max(0.05, num(raw?.h, fallback.h)));
  const x = Math.min(1 - w, Math.max(0, num(raw?.x, fallback.x)));
  const y = Math.min(1 - h, Math.max(0, num(raw?.y, fallback.y)));
  return { x, y, w, h };
}

// Used when the planner doesn't return boxes for a slide.
export function defaultTextBoxes(role: string): { headline: Box; body: Box } {
  if (role === "cta") {
    return {
      headline: { x: 0.08, y: 0.14, w: 0.84, h: 0.2 },
      body: { x: 0.08, y: 0.4, w: 0.84, h: 0.16 },
    };
  }
  return {
    headline: { x: 0.08, y: 0.1, w: 0.84, h: 0.22 },
    body: { x: 0.08, y: 0.38, w: 0.84, h: 0.3 },
  };
}

// Reads a reference's composition text (the same signal the image model follows)
// and returns starting boxes + alignment for a single post, so the editor opens
// matching where the reference puts its text. Horizontal: left/right/center.
// Vertical: top/bottom/middle. The user can still drag from here.
export function placementFromComposition(
  composition: string | null | undefined
): { headlineBox: Box; bodyBox: Box; headlineAlign: TextAlign; bodyAlign: TextAlign } {
  const t = (composition || "").toLowerCase();
  const align: TextAlign = /right[- ]align/.test(t)
    ? "right"
    : /left[- ]align/.test(t)
      ? "left"
      : "center";
  // Vertical zone of the headline band.
  const top = /\bbottom\b/.test(t) ? 0.58 : /\bmiddle\b|vertically cent/.test(t) ? 0.34 : 0.1;
  const x = align === "left" ? 0.08 : align === "right" ? 0.32 : 0.08;
  const w = align === "center" ? 0.84 : 0.6;
  return {
    headlineBox: { x, y: top, w, h: 0.2 },
    bodyBox: { x, y: Math.min(0.72, top + 0.24), w: align === "center" ? 0.84 : 0.7, h: 0.22 },
    headlineAlign: align,
    bodyAlign: align,
  };
}

// Logo corner/edge slots, as boxes. Used when the brand's logo position is auto-picked.
export function logoBoxFor(position: string, scale: number): Box {
  const s = Math.min(0.3, Math.max(0.08, scale));
  const m = 0.04;
  const slots: Record<string, { x: number; y: number }> = {
    "top-left": { x: m, y: m },
    "top-right": { x: 1 - s - m, y: m },
    "bottom-left": { x: m, y: 1 - s - m },
    "bottom-right": { x: 1 - s - m, y: 1 - s - m },
    "top-middle": { x: 0.5 - s / 2, y: m },
    "bottom-middle": { x: 0.5 - s / 2, y: 1 - s - m },
    center: { x: 0.5 - s / 2, y: 0.5 - s / 2 },
  };
  const p = slots[position] || slots["bottom-right"];
  return { x: p.x, y: p.y, w: s, h: s };
}

// ==================== Starting elements for a generated slide ====================

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

// Headline becomes H1. Body lines starting with "- " or "• " become bullets; otherwise the body is a paragraph.
// Alignment is taken from the slide's reference layout, per text block.
export function buildTexts(
  headline: string,
  body: string,
  boxes: { headline: Box; body: Box },
  align: { headline?: TextAlign; body?: TextAlign } = {}
): TextElement[] {
  const out: TextElement[] = [];
  if (headline.trim()) {
    out.push({
      id: newId("h1"),
      kind: "h1",
      text: headline.trim(),
      box: boxes.headline,
      style: { ...defaultStyleFor("h1"), align: align.headline ?? "center" },
    });
  }
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => /^[-•]\s/.test(l));
  if (bulletLines.length > 0 && bulletLines.length === lines.length) {
    out.push({
      id: newId("bullet"),
      kind: "bullet",
      text: lines.map((l) => l.replace(/^[-•]\s*/, "")).join("\n"),
      box: boxes.body,
      style: { ...defaultStyleFor("bullet"), align: align.body ?? "center" },
    });
  } else if (lines.length > 0) {
    out.push({
      id: newId("p"),
      kind: "p",
      text: lines.join("\n"),
      box: boxes.body,
      style: { ...defaultStyleFor("p"), align: align.body ?? "center" },
    });
  }
  return out;
}

// ==================== Drawing ====================

function fontString(style: TextStyle, size: number): string {
  return `${style.italic ? "italic " : ""}${style.bold ? 800 : 400} ${size}px "${style.fontFamily}", sans-serif`;
}

function wrapParagraph(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

// Bullets get a "• " prefix on each line before wrapping.
function linesFor(el: TextElement): string {
  if (el.kind !== "bullet") return el.text;
  return el.text
    .split("\n")
    .map((l) => (l.trim() ? `• ${l.trim()}` : ""))
    .join("\n");
}

// Shrinks the font until the wrapped text fits inside the box.
function fitText(
  ctx: CanvasRenderingContext2D,
  el: TextElement,
  W: number,
  H: number
): { size: number; lines: string[] } {
  const boxW = el.box.w * W;
  const boxH = el.box.h * H;
  const text = linesFor(el);
  let size = (el.style.sizePct / 100) * W * KIND_SCALE[el.kind];
  let lines: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    ctx.font = fontString(el.style, size);
    lines = wrapParagraph(ctx, text, boxW);
    const tooTall = lines.length * size * el.style.lineSpacing > boxH;
    if (!tooTall || size <= 8) break;
    size *= 0.94;
  }
  return { size, lines };
}

function drawTextElement(ctx: CanvasRenderingContext2D, el: TextElement, W: number, H: number) {
  const text = el.text.trim();
  if (!text) return;

  const { size, lines } = fitText(ctx, el, W, H);
  const lineHeight = size * el.style.lineSpacing;
  const boxX = el.box.x * W;
  const boxY = el.box.y * H;
  const boxW = el.box.w * W;
  const boxH = el.box.h * H;
  const blockH = lines.length * lineHeight;
  const top = boxY + Math.max(0, (boxH - blockH) / 2);

  ctx.font = fontString(el.style, size);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = el.style.color;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = size * 0.15;
  ctx.shadowOffsetY = size * 0.05;

  const band = el.style.bg === "white" || el.style.bg === "dark";
  if (band) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  lines.forEach((line, i) => {
    const y = top + i * lineHeight;
    const width = ctx.measureText(line).width;
    const x =
      el.style.align === "left"
        ? boxX
        : el.style.align === "right"
          ? boxX + boxW - width
          : boxX + (boxW - width) / 2;
    if (band && line.trim()) {
      // One rounded box per line, like TikTok's text background.
      const padX = size * 0.3;
      const padY = size * 0.12;
      const bx = x - padX;
      const by = y - padY + size * 0.04;
      const bw = width + padX * 2;
      const bh = size * 1.0 + padY * 2;
      const r = Math.min(bh / 2, size * 0.3);
      ctx.fillStyle = el.style.bg === "white" ? "#FFFFFF" : "rgba(0,0,0,0.62)";
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
      ctx.arcTo(bx, by + bh, bx, by, r);
      ctx.arcTo(bx, by, bx + bw, by, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = el.style.color;
    }
    ctx.fillText(line, x, y);
    const thickness = Math.max(1, size * 0.06);
    if (el.style.underline) ctx.fillRect(x, y + size * 0.92, width, thickness);
    if (el.style.strike) ctx.fillRect(x, y + size * 0.5, width, thickness);
  });

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

async function drawLogo(ctx: CanvasRenderingContext2D, logo: LogoElement, W: number, H: number) {
  const img = await loadImage(logo.src);
  const boxX = logo.box.x * W;
  const boxY = logo.box.y * H;
  const boxW = logo.box.w * W;
  const boxH = logo.box.h * H;
  // Fit inside the box without distortion, centred.
  const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  ctx.drawImage(img, boxX + (boxW - drawW) / 2, boxY + (boxH - drawH) / 2, drawW, drawH);
}

/** Draws the background, the logo box and every text element onto the canvas at the image's native size. */
export async function drawSlideLayout(
  canvas: HTMLCanvasElement,
  background: HTMLImageElement,
  layout: SlideLayout
): Promise<void> {
  const W = background.naturalWidth;
  const H = background.naturalHeight;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(background, 0, 0, W, H);

  if (layout.logo) {
    try {
      await drawLogo(ctx, layout.logo, W, H);
    } catch {
      // A logo that fails to load shouldn't block the text.
    }
  }

  // Wait for every font in use so the first draw doesn't fall back to a default.
  const families = Array.from(new Set(layout.texts.map((t) => t.style.fontFamily)));
  await Promise.all(
    families.map((family) =>
      document.fonts.load(`800 40px "${family}"`).catch(() => undefined)
    )
  );

  for (const el of layout.texts) drawTextElement(ctx, el, W, H);
}
