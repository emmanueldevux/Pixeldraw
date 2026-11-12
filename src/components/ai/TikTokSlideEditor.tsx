// ============================================================
// UXLLY — TikTok Slide Editor
// Shows each generated slide (copy-free background from the AI) with
// its text and logo already placed. Edit opens the slide popup, where
// every H1, H2, paragraph, bullet list and the logo can be moved,
// resized and rewritten. Downloads export exactly what the preview shows.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import type { CarouselSlideMessage } from "@/types";
import SlideStage from "@/components/ai/SlideStage";

export interface TikTokDisclosure {
  brandedContent: boolean;
  clientName: string | null;
}

interface TikTokSlideEditorProps {
  slides: CarouselSlideMessage[];
  disclosure?: TikTokDisclosure | null;
}

export default function TikTokSlideEditor({ slides, disclosure }: TikTokSlideEditorProps) {
  const [active, setActive] = useState(0);

  // A new generation starts from the first slide.
  useEffect(() => {
    setActive(0);
  }, [slides]);

  const current = slides[active];

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

      <SlideStage
        slides={slides}
        setLabel="TikTok"
        activeIndex={active}
        previewClassName="max-h-[52vh]"
        downloadPrefix="tiktok-slide"
      />

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
    </div>
  );
}
