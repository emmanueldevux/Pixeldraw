// ============================================================
// UXLLY — Templates page
// Published design templates (edited in /admin → Templates).
// Clicking one opens the "Use template" popup.
// ============================================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import UseTemplateModal, { Placeholder } from "@/components/templates/UseTemplateModal";
import type { PublicTemplate } from "@/lib/designTemplates/types";

const ASPECT_CLASS: Record<string, string> = { "9:16": "aspect-[9/16]", "4:5": "aspect-[4/5]", "1:1": "aspect-square", "16:9": "aspect-video" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<(PublicTemplate & { typicalMilli?: number })[] | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [open, setOpen] = useState<(PublicTemplate & { typicalMilli?: number }) | null>(null);

  useEffect(() => {
    fetch("/api/design-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setTemplates([]));
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set((templates || []).map((t) => t.category).filter(Boolean)))], [templates]);
  const shown = (templates || []).filter((t) => category === "All" || t.category === category);

  return (
    <>
      <DashboardHeader title="Templates" subtitle="Pick a template, add your product, get a finished design." onMenuClick={() => {}} />
      <div className="uxlly-content !max-w-none">
        {categories.length > 2 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium ${category === c ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {!templates ? (
          <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : shown.length === 0 ? (
          <div className="py-24 text-center text-sm text-gray-500">No templates yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {shown.map((t) => (
              <button key={t.id} onClick={() => setOpen(t)} className="group text-left">
                <div className={`relative ${ASPECT_CLASS[t.aspect] || "aspect-[9/16]"} rounded-2xl overflow-hidden bg-gray-100`}>
                  {t.coverImages[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.coverImages[0]} alt={t.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 [&>div]:!max-h-none [&>div]:h-full [&>div]:rounded-none">
                      <Placeholder template={t} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#A3F76B] text-black text-sm font-semibold shadow-lg">
                      <Sparkles size={15} /> Use template
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 text-sm font-semibold text-gray-900">{t.title}</p>
                <p className="text-xs text-gray-500">
                  {t.aspect}
                  {t.category ? ` · ${t.category}` : ""}
                  {t.styles.length ? ` · ${t.styles.length} styles` : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {open && <UseTemplateModal template={open} onClose={() => setOpen(null)} />}
    </>
  );
}
