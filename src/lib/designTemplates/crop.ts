// ============================================================
// UXLLY — trim a generated image to the template's aspect ratio.
// OpenAI renders portrait at 2:3; a 4:5 template is centre-trimmed to a
// true 4:5 here (the prompt keeps text and product inside that area).
// ============================================================
import sharp from "sharp";

const RATIO: Record<string, number> = { "9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1, "16:9": 16 / 9, "1.91:1": 1.91, "3:2": 3 / 2, "4:3": 4 / 3 };

async function toBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) return Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  const r = await fetch(src);
  return Buffer.from(await r.arrayBuffer());
}

/** Returns a PNG data URL trimmed to the aspect, or the original if it already fits (±1%). */
export async function trimToAspect(src: string, aspect: string): Promise<string> {
  const target = RATIO[aspect];
  if (!target) return src;
  const buf = await toBuffer(src);
  const img = sharp(buf);
  const { width = 0, height = 0 } = await img.metadata();
  if (!width || !height) return src;
  const current = width / height;
  if (Math.abs(current - target) / target < 0.01) return src;
  let w = width;
  let h = height;
  if (current < target) h = Math.round(width / target); // too tall → trim top/bottom
  else w = Math.round(height * target); // too wide → trim sides
  const out = await img
    .extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h })
    .png()
    .toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}
