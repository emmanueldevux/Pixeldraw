// ============================================================
// UXLLY — Templates page (original layout: breadcrumb header,
// pill tabs on top, masonry grid). Data = published templates.
// ============================================================
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search, Sparkles, X } from "lucide-react";
import UseTemplateProject from "@/components/templates/UseTemplateProject";
import UseTemplateModal, { Placeholder } from "@/components/templates/UseTemplateModal";
import type { PublicTemplate } from "@/lib/designTemplates/types";

type T = PublicTemplate & { typicalMilli?: number };

const ASPECT_CLASS: Record<string, string> = { "3:4": "aspect-[3/4]", "9:16": "aspect-[9/16]", "4:5": "aspect-[4/5]", "1:1": "aspect-square", "16:9": "aspect-video" };

/** Swipeable images for carousel and slideshow cards: arrows on hover, dots at the bottom. */
function CardSlider({ images, title, aspectClass }: { images: string[]; title: string; aspectClass: string }) {
  const [i, setI] = useState(0);
  const n = images.length;
  const go = (e: React.MouseEvent, d: number) => { e.stopPropagation(); setI((cur) => (cur + d + n) % n); };
  const arrow = "absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-black text-black flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black hover:text-white hover:scale-110 active:scale-95";
  return (
    <div className={`relative w-full ${aspectClass} overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[i]} alt={title} className="absolute inset-0 w-full h-full object-cover" />
      {n > 1 && (
        <>
          <button type="button" aria-label="Previous image" onClick={(e) => go(e, -1)} className={`${arrow} left-3`}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Next image" onClick={(e) => go(e, 1)} className={`${arrow} right-3`}><ChevronRight size={18} /></button>
          <div className="absolute bottom-3 inset-x-0 z-10 flex justify-center gap-1.5">
            {images.map((_, d) => (
              <button
                key={d}
                type="button"
                aria-label={`Go to image ${d + 1}`}
                onClick={(e) => { e.stopPropagation(); setI(d); }}
                className={`h-2 rounded-full border border-black transition-all duration-200 ${d === i ? "w-5 bg-white" : "w-2 bg-white/60 hover:bg-white hover:scale-125"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TemplatesInner() {
  const [templates, setTemplates] = useState<T[] | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const urlQ = useSearchParams()?.get("q") || "";
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);
  const [open, setOpen] = useState<T | null>(null);

  useEffect(() => {
    // Ads/thumbnail templates plus the admin's published carousel and slideshow styles, all shown as templates.
    const asCard = (s: { id: string; name: string; description?: string; cover?: string | null; preview?: string[] }, category: string, aspect: string, n: number): T =>
      ({
        id: s.id, number: n, title: s.name, description: s.description || "", category, tags: [], aspect, coverImages: Array.from(new Set([s.cover, ...(s.preview || [])].filter(Boolean) as string[])),
        kind: "pack", refImages: [], styles: [], needsProduct: false, useBrandBrain: true, published: true, sortOrder: 0, usageCount: 0,
      }) as unknown as T;
    const j = (u: string): Promise<any> => fetch(u).then((r) => (r.ok ? r.json() : {})).catch(() => ({})); // eslint-disable-line @typescript-eslint/no-explicit-any
    Promise.all([j("/api/design-templates"), j("/api/carousel-styles"), j("/api/slideshow/styles")]).then(([d, c, s]) => {
      const base: T[] = d.templates || [];
      const car = ((c.styles || []) as { id: string; name: string; description?: string; cover?: string | null; preview?: string[]; mine?: boolean }[]).filter((x) => !x.mine).map((x, i) => asCard(x, "Carousels", "4:5", 100 + i));
      const sl = ((s.styles || []) as { id: string; name: string; description?: string; cover?: string | null; preview?: string[]; mine?: boolean }[]).filter((x) => !x.mine).map((x, i) => asCard(x, "Slideshows", "3:4", 200 + i));
      setTemplates([...base, ...car, ...sl]);
    });
  }, []);

  const isRec = (t: T) => t.tags.some((x) => x.toLowerCase() === "recommended");
  const ORDER = ["Ads", "Carousels", "Thumbnails", "Slideshows"];

  const tabs = useMemo(() => {
    const list = templates || [];
    const cats = Array.from(new Set(list.map((t) => t.category).filter(Boolean) as string[]));
    cats.sort((a, b) => {
      const i = ORDER.indexOf(a), j = ORDER.indexOf(b);
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b);
    });
    return ["All", ...(list.some(isRec) ? ["Recommended"] : []), ...cats];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  // Open on Recommended when there is one, otherwise All.
  const tab = activeTab ?? (tabs.includes("Recommended") ? "Recommended" : "All");

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (templates || [])
      .filter((t) => tab === "All" || (tab === "Recommended" ? isRec(t) : t.category === tab))
      .filter((t) => {
        if (!words.length) return true;
        const hay = `${t.title} ${t.description} ${t.category} ${t.tags.join(" ")} ${t.aspect}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || a.sortOrder - b.sortOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, tab, q]);

  return (
    <div className="w-full">
      <div className="flex flex-col w-full min-w-0">

        <main className="flex-1">
          <div className="max-w-[1400px] mx-auto px-6 py-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
              <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 bg-gray-200/50 p-1 rounded-xl border border-gray-200 max-sm:w-full max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
                {tabs.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveTab(name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 whitespace-nowrap ${
                      tab === name ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                    }`}
                  >
                    {name === "Recommended" && <Sparkles size={14} />}
                    {name}
                  </button>
                ))}
              </div>

              <label className="hidden sm:flex items-center gap-2 h-11 w-64 sm:w-80 rounded-xl border border-gray-300 bg-white px-3.5 focus-within:border-gray-900">
                <Search size={16} className="text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search templates…"
                  className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                />
                {q && <button type="button" onClick={() => setQ("")} className="text-gray-400 hover:text-gray-700"><X size={14} /></button>}
              </label>
            </div>

            {!templates ? (
              <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
            ) : shown.length === 0 ? (
              <div className="py-24 text-center text-sm text-gray-500">{q ? `No templates match “${q}”.` : "No templates here yet."}</div>
            ) : (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                {shown.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setOpen(t)}
                    className="relative break-inside-avoid rounded-2xl overflow-hidden group cursor-pointer bg-gray-100 border border-gray-300"
                  >
                    {t.coverImages.length > 0 && (t.category === "Carousels" || t.category === "Slideshows") ? (
                      <CardSlider images={t.coverImages} title={t.title} aspectClass={ASPECT_CLASS[t.aspect] || "aspect-[4/5]"} />
                    ) : t.coverImages[0] ? (
                      // Cover image: full width, natural height (no cropping).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.coverImages[0]} alt={t.title} className="block w-full h-auto transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className={`relative w-full ${ASPECT_CLASS[t.aspect] || "aspect-[9/16]"}`}>
                        <div className="absolute inset-0 [&>div]:!max-h-none [&>div]:h-full [&>div]:rounded-none">
                          <Placeholder template={t} />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
                      <span className="flex items-center gap-2 px-4 py-2 bg-[#CCFF00] text-black text-sm font-semibold rounded-full shadow-lg">
                        <Sparkles size={16} /> Use template
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {open && ((open.kind === "pack" || open.coverImages.length > 0)
        ? <UseTemplateProject template={open} onClose={() => setOpen(null)} />
        : <UseTemplateModal template={open} onClose={() => setOpen(null)} />)}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesInner />
    </Suspense>
  );
}
