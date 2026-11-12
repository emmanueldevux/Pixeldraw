// ============================================================
// UXLLY — client-side helpers for slideshow images (browser only, free)
//   - resize an uploaded photo
//   - pull frames out of a video (no upload, no credits), score sharpness
//   - stack two images for a 2-in-1 slide
// ============================================================

export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

/** Draw `src` into a canvas of w×h, cropping to fill (centre). */
function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
  const k = Math.max(dw / sw, dh / sh);
  const cw = dw / k;
  const ch = dh / k;
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, dx, dy, dw, dh);
}

export function resizePhoto(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

/** Upload one data URL to storage; returns the URL to show in the editor. */
export async function uploadData(dataUrl: string): Promise<{ url: string; viewUrl: string }> {
  const r = await fetch("/api/slideshow/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Upload failed");
  return { url: d.url, viewUrl: d.viewUrl || d.url };
}

// ==================== Video frames ====================

export interface Frame {
  id: string;
  dataUrl: string; // cropped to the target shape, JPEG
  score: number; // sharpness (higher = sharper)
  time: number; // seconds
  blurry: boolean;
}

function sharpness(video: HTMLVideoElement): number {
  const w = 160;
  const h = Math.max(16, Math.round((video.videoHeight / video.videoWidth) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
  // variance of the Laplacian
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

/**
 * Reads a video file in the browser and returns evenly spaced frames cropped to `ratio` (w/h).
 * Nothing is uploaded here, so it costs no credits.
 */
export async function extractFrames(file: File, opts: { ratio: number; count?: number; outW?: number; onProgress?: (done: number, total: number) => void }): Promise<Frame[]> {
  const count = opts.count ?? 24;
  const outW = opts.outW ?? 1080;
  const outH = Math.round(outW / opts.ratio);
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("This video can't be read. Try an MP4 or MOV."));
    });
    const dur = video.duration;
    if (!Number.isFinite(dur) || dur <= 0) throw new Error("This video can't be read.");
    const frames: Frame[] = [];
    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const octx = out.getContext("2d")!;
    for (let i = 0; i < count; i++) {
      const t = Math.min(dur - 0.05, Math.max(0.05, ((i + 0.5) / count) * dur));
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = t;
      });
      const score = sharpness(video);
      drawCover(octx, video, video.videoWidth, video.videoHeight, 0, 0, outW, outH);
      frames.push({ id: `f${i}-${Math.round(t * 1000)}`, dataUrl: out.toDataURL("image/jpeg", 0.9), score, time: t, blurry: false });
      opts.onProgress?.(i + 1, count);
    }
    const sorted = [...frames].map((f) => f.score).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    for (const f of frames) f.blurry = f.score < median * 0.5;
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Picks up to `n` sharp frames spread across the video (never two neighbours). */
export function autoPick(frames: Frame[], n: number): string[] {
  const chosen: number[] = [];
  const order = frames.map((f, i) => ({ i, s: f.blurry ? -1 : f.score })).sort((a, b) => b.s - a.s);
  for (const o of order) {
    if (chosen.length >= n) break;
    if (o.s < 0) continue;
    if (chosen.some((c) => Math.abs(c - o.i) < 2)) continue;
    chosen.push(o.i);
  }
  return chosen.sort((a, b) => a - b).map((i) => frames[i].id);
}

// ==================== 2-in-1 ====================

/** Stacks two images top / bottom into one JPEG data URL (each half is cover-cropped). */
export async function stackImages(top: string, bottom: string, w: number, h: number): Promise<string> {
  const [a, b] = await Promise.all([loadImg(top), loadImg(bottom)]);
  const draw = (cw: number, ch: number) => {
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    drawCover(ctx, a, a.naturalWidth, a.naturalHeight, 0, 0, cw, ch / 2);
    drawCover(ctx, b, b.naturalWidth, b.naturalHeight, 0, ch / 2, cw, ch / 2);
    return c.toDataURL("image/jpeg", 0.88);
  };
  let out = draw(w, h);
  // keep the upload under typical request limits
  if (out.length > 4_200_000) out = draw(Math.round(w * 0.75), Math.round(h * 0.75));
  return out;
}
