// ============================================================
// UXLLY — Templates page (original layout: breadcrumb header,
// pill tabs on top, masonry grid). Data = published templates.
// ============================================================
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import UseTemplateModal, { Placeholder } from "@/components/templates/UseTemplateModal";
import type { PublicTemplate } from "@/lib/designTemplates/types";

type T = PublicTemplate & { typicalMilli?: number };

const ASPECT_CLASS: Record<string, string> = { "9:16": "aspect-[9/16]", "4:5": "aspect-[4/5]", "1:1": "aspect-square", "16:9": "aspect-video" };

function TemplatesInner() {
  const [templates, setTemplates] = useState<T[] | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const urlQ = useSearchParams()?.get("q") || "";
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);
  const [open, setOpen] = useState<T | null>(null);

  useEffect(() => {
    fetch("/api/design-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setTemplates([]));
  }, []);

  const isRec = (t: T) => t.tags.some((x) => x.toLowerCase() === "recommended");
  const ORDER = ["Static ads", "Carousel", "Slideshows", "Thumbnails"];

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
              <div className="flex flex-wrap items-center gap-2 bg-gray-200/50 p-1 rounded-xl border border-gray-200">
                {tabs.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveTab(name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      tab === name ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                    }`}
                  >
                    {name === "Recommended" && <Sparkles size={14} />}
                    {name}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 h-11 w-64 sm:w-80 rounded-xl border border-gray-300 bg-white px-3.5 focus-within:border-gray-900">
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
                    className="relative break-inside-avoid rounded-2xl overflow-hidden group cursor-pointer bg-gray-100"
                  >
                    <div className={`relative w-full ${ASPECT_CLASS[t.aspect] || "aspect-[9/16]"}`}>
                      {t.coverImages[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.coverImages[0]} alt={t.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="absolute inset-0 [&>div]:!max-h-none [&>div]:h-full [&>div]:rounded-none">
                          <Placeholder template={t} />
                        </div>
                      )}
                    </div>
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

      {open && <UseTemplateModal template={open} onClose={() => setOpen(null)} />}
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
