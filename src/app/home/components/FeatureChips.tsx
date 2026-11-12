"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialSymbol } from "../icons";
import { FEATURE_CHIPS } from "../data";

export function FeatureChips({ onPick }: { onPick?: (text: string) => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setShowLeft(el.scrollLeft > 1);
    setShowRight(el.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync]);

  function scrollBy(direction: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: direction * 300, behavior: "smooth" });
  }

  return (
    <div className="home-chips-wrap">
      <div className="home-chips-clip">
        <div className={`home-chips-row${showLeft ? " show-left" : ""}${showRight ? " show-right" : ""}`}>
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-1)}
            className={`home-chip-nav left${showLeft ? " is-visible" : " is-hidden"}`}
          >
            <MaterialSymbol name="chevron_left" style={{ fontSize: 18 }} />
          </button>

          <div ref={scrollerRef} onScroll={sync} className="home-chips-scroller home-no-scrollbar">
            {FEATURE_CHIPS.map((chip, index) => (
              <div key={`${chip.label}-${index}`} className="home-chip-item">
                <button
                  type="button"
                  onClick={() => onPick?.(chip.label)}
                  className="home-chip-btn"
                >
                  <span className="home-chip-icon-wrap">
                    {chip.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/images/logos/${chip.logo}.svg`} alt="" />
                    ) : (
                      <MaterialSymbol name={chip.icon ?? "spark"} />
                    )}
                  </span>
                  <span className="home-chip-label-wrap">
                    <span className="home-chip-label">{chip.label}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollBy(1)}
            className={`home-chip-nav right${showRight ? " is-visible" : " is-hidden"}`}
          >
            <MaterialSymbol name="chevron_right" style={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    </div>
  );
}