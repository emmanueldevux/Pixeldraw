// ============================================================
// UXLLY — Canvas logo overlay
// Shows a generated image with the brand logo as a DRAGGABLE layer on
// top (not baked in). Dragging snaps the logo to one of 7 slots
// (corners, edge-middles, center). Download composites the image + logo
// at the chosen slot into a PNG — so what you place is what you save.
// ============================================================

"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Download, Move } from "lucide-react";

export interface CanvasLogoData {
  url: string;
  position: string; // starting slot
  scale: number; // logo width as a fraction of image width
}

type Slot = "top-left" | "top-middle" | "top-right" | "center" | "bottom-left" | "bottom-middle" | "bottom-right";

const SLOTS: Slot[] = ["top-left", "top-middle", "top-right", "center", "bottom-left", "bottom-middle", "bottom-right"];
const MARGIN = 0.04;

// Top-left fraction of the logo box for a slot, given logo size s (fraction of width).
function slotOrigin(slot: Slot, s: number): { x: number; y: number } {
  const m = MARGIN;
  switch (slot) {
    case "top-left": return { x: m, y: m };
    case "top-middle": return { x: 0.5 - s / 2, y: m };
    case "top-right": return { x: 1 - s - m, y: m };
    case "center": return { x: 0.5 - s / 2, y: 0.5 - s / 2 };
    case "bottom-left": return { x: m, y: 1 - s - m };
    case "bottom-middle": return { x: 0.5 - s / 2, y: 1 - s - m };
    case "bottom-right": default: return { x: 1 - s - m, y: 1 - s - m };
  }
}

function nearestSlot(px: number, py: number, s: number): Slot {
  let best: Slot = "bottom-right";
  let bestD = Infinity;
  for (const slot of SLOTS) {
    const o = slotOrigin(slot, s);
    const cx = o.x + s / 2;
    const cy = o.y + s / 2;
    const d = (cx - px) ** 2 + (cy - py) ** 2;
    if (d < bestD) { bestD = d; best = slot; }
  }
  return best;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}

interface Props {
  imageUrl: string;
  logo: CanvasLogoData | null;
  aspect?: string; // e.g. "1 / 1"
  downloadName?: string;
}

export default function CanvasLogo({ imageUrl, logo, aspect = "1 / 1", downloadName = "uxlly-post.png" }: Props) {
  const scale = logo ? Math.min(0.5, Math.max(0.05, logo.scale || 0.14)) : 0.14;
  const startSlot = (logo?.position && SLOTS.includes(logo.position as Slot) ? logo.position : "bottom-right") as Slot;
  const [slot, setSlot] = useState<Slot>(startSlot);
  const [free, setFree] = useState<{ x: number; y: number } | null>(null); // live drag position (logo top-left fraction)
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const origin = free ?? slotOrigin(slot, scale);

  const onDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (!logo) return;
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    dragging.current = true;
  };

  const onMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    // Center the logo on the pointer, then clamp inside the frame.
    let x = (ev.clientX - r.left) / r.width - scale / 2;
    let y = (ev.clientY - r.top) / r.height - scale / 2;
    x = Math.min(1 - scale, Math.max(0, x));
    y = Math.min(1 - scale, Math.max(0, y));
    setFree({ x, y });
  };

  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (free) {
      setSlot(nearestSlot(free.x + scale / 2, free.y + scale / 2, scale));
      setFree(null);
    }
  };

  const download = async () => {
    setExporting(true);
    setErr(null);
    try {
      const img = await loadImg(imageUrl);
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      ctx.drawImage(img, 0, 0, W, H);
      if (logo) {
        const lg = await loadImg(logo.url);
        const o = slotOrigin(slot, scale);
        const lw = scale * W;
        const lh = lw * (lg.naturalHeight / lg.naturalWidth);
        ctx.drawImage(lg, o.x * W, o.y * H, lw, lh);
      }
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/png")!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setErr("Couldn't export. The image host may block editing (cross-origin).");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={boxRef}
        className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-200 max-h-[60vh]"
        style={{ aspectRatio: aspect }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Generated" className="w-full h-full object-contain select-none" draggable={false} />
        {logo && (
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="absolute cursor-move touch-none group"
            style={{ left: `${origin.x * 100}%`, top: `${origin.y * 100}%`, width: `${scale * 100}%` }}
            title="Drag to reposition — snaps to corners"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.url} alt="logo" className="w-full h-auto pointer-events-none" draggable={false} />
            <div className="absolute inset-0 ring-1 ring-blue-400/0 group-hover:ring-blue-400/80 rounded" />
          </div>
        )}
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}

      <div className="flex items-center gap-3">
        {logo && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Move size={12} /> Drag the logo — snaps to corners
          </span>
        )}
        <button
          onClick={download}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 shadow-sm disabled:opacity-50"
        >
          <Download size={16} /> {exporting ? "Preparing…" : "Download"}
        </button>
      </div>
    </div>
  );
}
