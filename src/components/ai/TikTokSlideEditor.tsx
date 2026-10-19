// ============================================================
// UXLLY — TikTok Slide Editor
// Shows each generated slide (clean background from the AI) with an
// editable text layer on top. Text, position, font, size, colour and
// caption style are all editable; download combines the image and text.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { CarouselSlideMessage } from "@/types";
import Button from "@/components/ui/Button";
import {
  OVERLAY_FONTS,
  DEFAULT_OVERLAY_STYLE,
  drawSlide,
  fontsStylesheetUrl,
  loadImage,
  type CaptionStyle,
  type OverlayStyle,
  type SlideTextLayer,
  type TextPosition,
} from "@/lib/overlay/slideText";

export interface TikTokDisclosure {
  brandedContent: boolean;
  clientName: string | null;
}

interface TikTokSlideEditorProps {
  slides: CarouselSlideMessage[];
  disclosure?: TikTokDisclosure | null;
}

function initialLayers(slides: CarouselSlideMessage[]): SlideTextLayer[] {
  return slides.map((s) => ({
    text: s.body ? `${s.headline}\n${s.body}` : s.headline,
    position: "center" as TextPosition,
  }));
}

export default function TikTokSlideEditor({ slides, disclosure }: TikTokSlideEditorProps) {
  const [layers, setLayers] = useState<SlideTextLayer[]>(() => initialLayers(slides));
  const [style, setStyle] = useState<OverlayStyle>(DEFAULT_OVERLAY_STYLE);
  const [active, setActive] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement>());

  // A new generation replaces the text layers.
  useEffect(() => {
    setLayers(initialLayers(slides));
    setActive(0);
  }, [slides]);

  // Load the editor's web fonts once.
  useEffect(() => {
    const id = "uxlly-overlay-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = fontsStylesheetUrl();
    document.head.appendChild(link);
  }, []);

  const getImage = async (url: string) => {
    const cached = imageCache.current.get(url);
    if (cached) return cached;
    const img = await loadImage(url);
    imageCache.current.set(url, img);
    return img;
  };

  // Redraw the preview whenever the slide, text, or style changes.
  useEffect(() => {
    let cancelled = false;
    const slide = slides[active];
    const canvas = canvasRef.current;
    if (!slide?.imageUrl || !canvas) return;

    (async () => {
      try {
        const img = await getImage(slide.imageUrl);
        if (!cancelled) await drawSlide(canvas, img, layers[active], style);
        if (!cancelled) setExportError(null);
      } catch {
        if (!cancelled) setExportError("This image couldn't load for editing. Try regenerating the slide.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // getImage is stable enough for this effect; the cache lives in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, layers, style, slides]);

  const updateActiveLayer = (patch: Partial<SlideTextLayer>) => {
    setLayers((prev) => prev.map((l, i) => (i === active ? { ...l, ...patch } : l)));
  };

  const renderSlideToBlob = async (index: number): Promise<Blob> => {
    const slide = slides[index];
    if (!slide?.imageUrl) throw new Error("No image for this slide");
    const img = await getImage(slide.imageUrl);
    const off = document.createElement("canvas");
    await drawSlide(off, img, layers[index], style);
    return new Promise((resolve, reject) =>
      off.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png")
    );
  };

  const downloadSlide = async (index: number) => {
    try {
      const blob = await renderSlideToBlob(index);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tiktok-slide-${slides[index].slideNumber}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setExportError(null);
    } catch {
      setExportError(
        "Couldn't export this slide. The image host may block editing (cross-origin). Storing slide images on your own storage fixes this."
      );
    }
  };

  const downloadAll = async () => {
    setExporting(true);
    for (let i = 0; i < slides.length; i++) {
      if (!slides[i].imageUrl) continue;
      await downloadSlide(i);
      await new Promise((r) => setTimeout(r, 400));
    }
    setExporting(false);
  };

  const positions: { value: TextPosition; label: string }[] = [
    { value: "top", label: "Top" },
    { value: "center", label: "Middle" },
    { value: "bottom", label: "Bottom" },
  ];
  const captionStyles: { value: CaptionStyle; label: string }[] = [
    { value: "plain", label: "Plain" },
    { value: "box", label: "Box" },
    { value: "outline", label: "Outline" },
  ];

  const current = slides[active];
  const activeLayer = layers[active];

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900">TikTok slideshow</h3>
        <span className="text-xs text-ink-400">
          Slide {current?.slideNumber} of {slides.length}
        </span>
      </div>

      {disclosure?.brandedContent && (
        <p className="text-xs text-ink-500 rounded-lg bg-surface-50 border border-surface-200 p-2">
          Publish with TikTok&apos;s branded-content toggle on
          {disclosure.clientName ? ` and ${disclosure.clientName} tagged as the brand partner` : ""}.
        </p>
      )}

      {/* ==================== Preview ==================== */}
      <div className="flex justify-center">
        {current?.imageUrl ? (
          <canvas
            ref={canvasRef}
            className="rounded-xl shadow-card max-h-[52vh] w-auto max-w-full"
          />
        ) : (
          <div className="w-full aspect-[2/3] max-h-[52vh] flex items-center justify-center rounded-xl bg-surface-100 text-xs text-red-400">
            This slide failed to generate
          </div>
        )}
      </div>

      {/* ==================== Slide strip ==================== */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {slides.map((slide, i) => (
          <button
            key={slide.slideNumber}
            onClick={() => setActive(i)}
            className={`shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-colors ${
              i === active ? "border-brand-500" : "border-surface-200 hover:border-surface-300"
            } bg-surface-100`}
          >
            {slide.imageUrl ? (
              <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[8px] text-red-400">✕</div>
            )}
          </button>
        ))}
      </div>

      {/* ==================== Text for this slide ==================== */}
      <div>
        <label className="text-xs text-ink-600 mb-1 block">Slide text</label>
        <textarea
          value={activeLayer?.text ?? ""}
          onChange={(e) => updateActiveLayer({ text: e.target.value })}
          rows={4}
          className="uxlly-input text-xs w-full"
        />
      </div>

      <div>
        <label className="text-xs text-ink-600 mb-1 block">Position</label>
        <div className="flex gap-1.5">
          {positions.map((p) => (
            <button
              key={p.value}
              onClick={() => updateActiveLayer({ position: p.value })}
              className={`flex-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                activeLayer?.position === p.value
                  ? "border-brand-500 bg-brand-50 text-brand-600"
                  : "border-surface-200 text-ink-600 hover:bg-surface-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== Style (applies to every slide) ==================== */}
      <div className="rounded-xl border border-surface-200 p-3 space-y-3">
        <p className="text-xs font-semibold text-ink-700">Style — applies to all slides</p>

        <div>
          <label className="text-xs text-ink-600 mb-1 block">Font</label>
          <select
            value={style.fontFamily}
            onChange={(e) => setStyle({ ...style, fontFamily: e.target.value })}
            className="uxlly-input text-xs w-full"
          >
            {OVERLAY_FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-ink-600 flex items-center gap-2">
            Colour
            <input
              type="color"
              value={style.color}
              onChange={(e) => setStyle({ ...style, color: e.target.value })}
              className="w-8 h-8 rounded border border-surface-200 bg-transparent"
            />
          </label>
        </div>

        <div>
          <label className="text-xs text-ink-600 mb-1 block">Size ({style.sizePct.toFixed(1)}%)</label>
          <input
            type="range"
            min={3}
            max={12}
            step={0.5}
            value={style.sizePct}
            onChange={(e) => setStyle({ ...style, sizePct: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-xs text-ink-600 mb-1 block">Caption style</label>
          <div className="flex gap-1.5">
            {captionStyles.map((c) => (
              <button
                key={c.value}
                onClick={() => setStyle({ ...style, captionStyle: c.value })}
                className={`flex-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                  style.captionStyle === c.value
                    ? "border-brand-500 bg-brand-50 text-brand-600"
                    : "border-surface-200 text-ink-600 hover:bg-surface-50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {exportError && <p className="text-xs text-red-500">{exportError}</p>}

      {/* ==================== Export ==================== */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => downloadSlide(active)}
          disabled={!current?.imageUrl || exporting}
        >
          <Download size={14} className="mr-1" />
          This slide
        </Button>
        <Button
          variant="primary"
          onClick={downloadAll}
          loading={exporting}
          disabled={!slides.some((s) => s.imageUrl)}
        >
          <Download size={14} className="mr-1" />
          Download all ({slides.filter((s) => s.imageUrl).length})
        </Button>
      </div>
    </div>
  );
}
