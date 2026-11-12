// ============================================================
// UXLLY — Slide Stage
// One slide at a time, drawn with its text and logo layers on top of
// the copy-free background. Edit opens the slide popup. Owns the
// per-slide layouts so edits survive switching slides, and exports
// exactly what the preview shows.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Pencil } from "lucide-react";
import type { CarouselSlideMessage } from "@/types";
import Button from "@/components/ui/Button";
import SlideEditModal, { layoutFromSlide } from "@/components/ai/SlideEditModal";
import { drawSlideLayout, type SlideLayout } from "@/lib/overlay/elements";
import { loadImage } from "@/lib/overlay/slideText";

interface SlideStageProps {
  slides: CarouselSlideMessage[];
  setLabel: string; // "Carousel" or "TikTok"
  activeIndex: number;
  previewClassName?: string;
  downloadPrefix?: string; // file name prefix, e.g. "tiktok-slide" or "slide"
}

export default function SlideStage({
  slides,
  setLabel,
  activeIndex,
  previewClassName = "max-h-[52vh]",
  downloadPrefix = "slide",
}: SlideStageProps) {
  const [layouts, setLayouts] = useState<SlideLayout[]>(() => slides.map(layoutFromSlide));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement>());

  // A new generation replaces every slide's layout.
  useEffect(() => {
    setLayouts(slides.map(layoutFromSlide));
    setEditing(false);
  }, [slides]);

  const current = slides[activeIndex];

  const getImage = async (url: string) => {
    const cached = imageCache.current.get(url);
    if (cached) return cached;
    const img = await loadImage(url);
    imageCache.current.set(url, img);
    return img;
  };

  // Redraw the preview whenever the slide or its layout changes.
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!current?.imageUrl || !canvas || !layouts[activeIndex]) return;

    (async () => {
      try {
        const img = await getImage(current.imageUrl);
        if (!cancelled) await drawSlideLayout(canvas, img, layouts[activeIndex]);
        if (!cancelled) setError(null);
      } catch {
        if (!cancelled) setError("This image couldn't load for editing. Try regenerating the slide.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeIndex, layouts, current]);

  const renderSlideToBlob = async (index: number): Promise<Blob> => {
    const slide = slides[index];
    if (!slide?.imageUrl || !layouts[index]) throw new Error("No image for this slide");
    const img = await getImage(slide.imageUrl);
    const off = document.createElement("canvas");
    await drawSlideLayout(off, img, layouts[index]);
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
      a.download = `${downloadPrefix}-${slides[index].slideNumber}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setError(null);
    } catch {
      setError(
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

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {current?.imageUrl ? (
        <canvas ref={canvasRef} className={`rounded-xl shadow-card w-auto max-w-full ${previewClassName}`} />
      ) : (
        <div className="w-full aspect-square max-h-[52vh] flex items-center justify-center rounded-xl bg-surface-100 text-xs text-red-400">
          This slide failed to generate
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={() => setEditing(true)} disabled={!current?.imageUrl}>
          <Pencil size={14} className="mr-1" />
          Edit slide {current?.slideNumber}
        </Button>
        <Button variant="ghost" onClick={() => downloadSlide(activeIndex)} disabled={!current?.imageUrl || exporting}>
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

      {editing && current && layouts[activeIndex] && (
        <SlideEditModal
          key={`${current.slideNumber}-${current.imageUrl}`}
          slide={current}
          setLabel={setLabel}
          initialLayout={layouts[activeIndex]}
          onClose={() => setEditing(false)}
          onSave={(next) => setLayouts((prev) => prev.map((l, i) => (i === activeIndex ? next : l)))}
        />
      )}
    </div>
  );
}
