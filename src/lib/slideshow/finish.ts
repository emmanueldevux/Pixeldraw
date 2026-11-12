// ============================================================
// UXLLY — finishing a slideshow photo: crop to the shape, enlarge, sharpen.
// The image model renders at most 1024x1536. Enlarging in code makes the
// download crisp for TikTok, but it cannot add real detail.
// ============================================================
import sharp from "sharp";
import { ASPECT_PX, HALF_PX, type SlideshowAspect } from "./types";

async function toBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) return Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  const r = await fetch(src);
  if (!r.ok) throw new Error(`Could not load image (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

/** Centre-crop to a ratio, resize with Lanczos, light sharpen, JPEG. Returns a data URL. */
async function cropResize(src: string, w: number, h: number): Promise<string> {
  const buf = await toBuffer(src);
  const out = await sharp(buf)
    .rotate()
    .resize(w, h, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .sharpen({ sigma: 0.7, m1: 0.8, m2: 1.4 })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

/** Full slide in the chosen shape. */
export function finishSlide(src: string, aspect: SlideshowAspect): Promise<string> {
  const p = ASPECT_PX[aspect];
  return cropResize(src, p.w, p.h);
}

/** One half of a 2-in-1 slide (3:2). */
export function finishHalf(src: string): Promise<string> {
  return cropResize(src, HALF_PX.w, HALF_PX.h);
}
