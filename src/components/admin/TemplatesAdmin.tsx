// ============================================================
// UXLLY — Admin → Templates
// Edit design templates ("prompt recipes"): details, cover images,
// the prompt with [[Param]] placeholders, each param's default and
// user field, and the style menu used by [[STYLES]].
// ============================================================
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Eye, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { btnPrimary, btnSecondary, inputCls } from "@/components/billing/Shell";
import { ASPECTS, missingParams, renderPrompt, type DesignTemplate, type TemplateParam, type TemplateStyle } from "@/lib/designTemplates/types";

const label = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5";
const box = "rounded-xl border border-gray-200 bg-white p-5";

export const TYPE_CATEGORIES = ["Static ads", "Carousel", "Slideshows"];
const isRec = (tags: string[]) => tags.some((t) => t.toLowerCase() === "recommended");
const withRec = (tags: string[], on: boolean) => {
  const rest = tags.filter((t) => t.toLowerCase() !== "recommended");
  return on ? ["recommended", ...rest] : rest;
};

type Draft = Omit<DesignTemplate, "id" | "number" | "usageCount"> & { id?: string; number?: number; usageCount?: number };

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [v, setV] = useState("");
  const add = () => {
    const x = v.trim().replace(/,$/, "");
    if (x && !tags.some((t) => t.toLowerCase() === x.toLowerCase())) onChange([...tags, x]);
    setV("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-2">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}><X size={12} /></button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none px-1 py-1"
        placeholder="e.g. skincare, sale, dark"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
      />
    </div>
  );
}

const BLANK: Draft = {
  kind: "prompt",
  refImages: [],
  packDna: "",
  refDnas: [],
  title: "New template",
  description: "",
  category: "",
  tags: [],
  aspect: "9:16",
  coverImages: [],
  prompt: "You are a senior art director…\n\n[[STYLES]]",
  params: [],
  styles: [],
  needsProduct: true,
  useBrandBrain: true,
  published: false,
  sortOrder: 0,
};

const BLANK_PACK = (): Draft => ({
  ...structuredClone(BLANK),
  kind: "pack",
  title: "New reference pack",
  aspect: "4:5",
  prompt: "",
  needsProduct: false,
});

export default function TemplatesAdmin({ setMsg }: { setMsg: (m: string | null) => void }) {
  const [list, setList] = useState<DesignTemplate[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (selectId?: string) => {
    const r = await fetch("/api/admin/templates");
    const d = await r.json();
    if (!r.ok) return setMsg(d.error || "Could not load templates");
    setList(d.templates);
    const pick = d.templates.find((t: DesignTemplate) => t.id === selectId) || d.templates[0];
    if (pick) setDraft(structuredClone(pick));
  }, [setMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const missing = useMemo(() => (draft ? missingParams(draft.prompt, draft.params) : []), [draft]);
  const usesStyles = draft?.prompt.includes("[[STYLES]]");

  if (!list || !draft) {
    return <div className="mt-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const setParam = (i: number, patch: Partial<TemplateParam>) => set("params", draft.params.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  const setStyle = (i: number, patch: Partial<TemplateStyle>) => set("styles", draft.styles.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  const move = <T,>(arr: T[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const c = [...arr];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };

  async function quick(t: DesignTemplate, patch: Partial<DesignTemplate>) {
    const next = { ...t, ...patch };
    setList((cur) => (cur ? cur.map((x) => (x.id === t.id ? next : x)) : cur));
    setDraft((cur) => (cur && cur.id === t.id ? { ...cur, ...patch } : cur));
    const r = await fetch("/api/admin/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", id: t.id, template: next }) });
    setMsg(r.ok ? `Saved "${t.title}".` : "Could not save that change.");
  }

  const allCats = Array.from(new Set([...TYPE_CATEGORIES, ...(list || []).map((t) => t.category).filter(Boolean)]));
  const filtered = (list || []).filter((t) => {
    const hay = `${t.title} ${t.category} ${t.tags.join(" ")}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (filter === "All") return true;
    if (filter === "Unclassified") return !t.category;
    if (filter === "Recommended") return isRec(t.tags);
    return t.category === filter;
  });
  const unclassified = (list || []).filter((t) => !t.category).length;

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    const r = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", id: draft.id, template: draft }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) return setMsg(d.error || "Save failed");
    setMsg(`Template ${d.template.number} saved.`);
    await load(d.template.id);
  }

  async function remove() {
    if (!draft?.id || !confirm(`Delete template ${draft.number}? This can't be undone.`)) return;
    await fetch("/api/admin/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: draft.id }) });
    setMsg("Template deleted.");
    await load();
  }

  async function addCovers(files: FileList | null) {
    if (!files || !draft) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(String(rd.result));
        rd.onerror = rej;
        rd.readAsDataURL(f);
      });
      const r = await fetch("/api/admin/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "uploadCover", dataUrl }) });
      const d = await r.json();
      if (r.ok) urls.push(d.url);
      else setMsg(d.error || "Upload failed");
    }
    setUploading(false);
    setDraft((cur) => (cur ? { ...cur, coverImages: [...cur.coverImages, ...urls].slice(0, 8) } : cur));
    if (urls.length) setMsg("Images added. Click Save to keep them.");
  }

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* List */}
      <div className="space-y-2">
        <button className={`${btnSecondary} w-full inline-flex items-center justify-center gap-1.5`} onClick={() => setDraft(structuredClone(BLANK))}>
          <Plus size={15} /> New template
        </button>
        <button className={`${btnSecondary} w-full inline-flex items-center justify-center gap-1.5`} onClick={() => setDraft(BLANK_PACK())}>
          <ImagePlus size={15} /> New reference pack
        </button>
        <input className={inputCls} placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {["All", "Unclassified", "Recommended", ...allCats].map((c) => (
            <button key={c} onClick={() => setFilter(c)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${filter === c ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {c}{c === "Unclassified" && unclassified ? ` (${unclassified})` : ""}
            </button>
          ))}
        </div>
        {filtered.map((t) => (
          <div
            key={t.id}
            onClick={() => setDraft(structuredClone(t))}
            className={`cursor-pointer rounded-xl border p-3 transition-colors ${draft.id === t.id ? "border-gray-900 bg-white" : "border-gray-200 bg-white/60 hover:bg-white"}`}
          >
            <p className="text-xs font-semibold text-gray-500">Template {t.number}{t.kind === "pack" ? " · Reference pack" : ""}</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
            <p className="text-xs text-gray-500">
              {t.published ? "Published" : "Draft"} · used {t.usageCount}×
            </p>
            <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <select
                className={`flex-1 min-w-0 rounded-lg border px-2 py-1 text-xs ${t.category ? "border-gray-200 text-gray-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}
                value={t.category}
                onChange={(e) => quick(t, { category: e.target.value })}
              >
                <option value="">Pick a category…</option>
                {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                title="Recommended"
                onClick={() => quick(t, { tags: withRec(t.tags, !isRec(t.tags)) })}
                className={`px-2 py-1 rounded-lg border text-xs font-semibold ${isRec(t.tags) ? "bg-yellow-100 border-yellow-300 text-yellow-800" : "bg-white border-gray-200 text-gray-500"}`}
              >
                ★
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="space-y-5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">{draft.id ? `Template ${draft.number}` : draft.kind === "pack" ? "New reference pack" : "New template"}{draft.kind === "pack" ? " · Reference pack" : ""}</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800 mr-2">
              <input type="checkbox" checked={draft.published} onChange={(e) => set("published", e.target.checked)} /> Published
            </label>
            {draft.id && <button className={btnSecondary} onClick={remove}><Trash2 size={15} /></button>}
            <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>

        {/* Details */}
        <div className={box}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><span className={label}>Title</span><input className={inputCls} value={draft.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className="sm:col-span-2"><span className={label}>Description (shown to users)</span><textarea className={`${inputCls} h-20`} value={draft.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="sm:col-span-2">
              <span className={label}>Category (the tab it appears under)</span>
              <div className="flex flex-wrap items-center gap-2">
                {allCats.map((c) => (
                  <button key={c} type="button" onClick={() => set("category", c)} className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${draft.category === c ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>{c}</button>
                ))}
                <input className={`${inputCls} !w-44`} placeholder="New category…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = e.currentTarget.value.trim(); if (v) { set("category", v); e.currentTarget.value = ""; } } }} />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-800">
                <input type="checkbox" checked={isRec(draft.tags)} onChange={(e) => set("tags", withRec(draft.tags, e.target.checked))} /> Recommended (also shows in the Recommended tab)
              </label>
            </div>
            <div>
              <span className={label}>Format</span>
              <select className={inputCls} value={draft.aspect} onChange={(e) => set("aspect", e.target.value as Draft["aspect"])}>
                {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><span className={label}>Tags (help users find it in search; press Enter or comma)</span><TagInput tags={draft.tags.filter((t) => t.toLowerCase() !== "recommended")} onChange={(t) => set("tags", isRec(draft.tags) ? withRec(t, true) : t)} /></div>
            <div><span className={label}>Order on the templates page</span><input className={inputCls} type="number" value={draft.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></div>
            <div className="flex flex-col justify-end gap-2 text-sm text-gray-800">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.needsProduct} onChange={(e) => set("needsProduct", e.target.checked)} /> Users must upload a product photo</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.useBrandBrain} onChange={(e) => set("useBrandBrain", e.target.checked)} /> Write words in the project&apos;s brand voice</label>
            </div>
          </div>
        </div>

        {/* Covers */}
        <div className={box}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Example images</p>
              <p className="text-xs text-gray-500">The first one is the cover on the templates page. Up to 8.</p>
            </div>
            <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add images
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addCovers(e.target.files); e.target.value = ""; }} />
          </div>
          {draft.coverImages.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {draft.coverImages.map((src, i) => (
                <div key={src.slice(-40) + i} className="relative w-28 aspect-[9/16] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/90">Cover</span>}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 opacity-0 group-hover:opacity-100 bg-black/40">
                    <button className="text-white p-1" onClick={() => set("coverImages", move(draft.coverImages, i, -1))} aria-label="Move left"><ArrowUp size={13} className="-rotate-90" /></button>
                    <button className="text-white p-1" onClick={() => set("coverImages", draft.coverImages.filter((_, n) => n !== i))} aria-label="Remove"><X size={13} /></button>
                    <button className="text-white p-1" onClick={() => set("coverImages", move(draft.coverImages, i, 1))} aria-label="Move right"><ArrowDown size={13} className="-rotate-90" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">No images yet. Until you add some, the templates page shows a styled placeholder.</p>
          )}
        </div>

        {draft.kind === "pack" ? (
          <PackEditor draft={draft} setDraft={setDraft} setMsg={setMsg} />
        ) : (
        <>
        {/* Prompt */}
        <div className={box}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Prompt</p>
              <p className="text-xs text-gray-500">
                Use <code className="px-1 rounded bg-gray-100">[[Param name]]</code> for fill-ins, <code className="px-1 rounded bg-gray-100">[[STYLES]]</code> where the style menu goes and <code className="px-1 rounded bg-gray-100">[[BRAND_COLOURS]]</code> for the project&apos;s brand colours. Users never see this text.
              </p>
            </div>
            <button
              className={`${btnSecondary} inline-flex items-center gap-1.5 shrink-0`}
              onClick={() => setPreview(renderPrompt(draft, {}, null, "BRAND CONTEXT: (the project's brand voice is added here when a user picks a project)", "use the brand's colours exactly: primary #XXXXXX … (filled from the picked project)"))}
            >
              <Eye size={15} /> Preview final prompt
            </button>
          </div>
          <textarea className={`${inputCls} mt-3 h-[420px] font-mono text-[13px] leading-relaxed`} value={draft.prompt} onChange={(e) => set("prompt", e.target.value)} spellCheck={false} />
          {missing.length > 0 && (
            <p className="mt-2 text-sm text-amber-700 flex items-center gap-1.5">
              <AlertTriangle size={15} /> No parameter set up for: {missing.map((m) => `[[${m}]]`).join(", ")}. Add them below or they&apos;ll be removed from the prompt.
            </p>
          )}
          {draft.styles.length > 0 && !usesStyles && (
            <p className="mt-2 text-sm text-amber-700 flex items-center gap-1.5">
              <AlertTriangle size={15} /> You have styles but the prompt has no [[STYLES]] placeholder, so they won&apos;t be used.
            </p>
          )}
        </div>

        {/* Params */}
        <div className={box}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Parameters</p>
              <p className="text-xs text-gray-500">The default is used when the user leaves it empty. &quot;Wrap&quot; phrases the user&apos;s text inside the prompt; {"{value}"} is what they typed.</p>
            </div>
            <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => set("params", [...draft.params, { key: missing[0] || "", defaultValue: "", userEditable: false, userLabel: "", userPlaceholder: "", wrap: "" }])}>
              <Plus size={15} /> Add
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {draft.params.map((p, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex gap-3 items-end">
                  <div className="flex-1"><span className={label}>Name in prompt</span><input className={`${inputCls} font-mono`} value={p.key} onChange={(e) => setParam(i, { key: e.target.value })} placeholder="Headline" /></div>
                  <label className="flex items-center gap-2 text-sm text-gray-800 pb-2.5 whitespace-nowrap"><input type="checkbox" checked={p.userEditable} onChange={(e) => setParam(i, { userEditable: e.target.checked })} /> Users can fill in</label>
                  <button className={`${btnSecondary} mb-0.5`} onClick={() => set("params", draft.params.filter((_, n) => n !== i))} aria-label="Remove"><Trash2 size={15} /></button>
                </div>
                <div><span className={label}>Default text</span><textarea className={`${inputCls} h-16`} value={p.defaultValue} onChange={(e) => setParam(i, { defaultValue: e.target.value })} /></div>
                {p.userEditable && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><span className={label}>Field label</span><input className={inputCls} value={p.userLabel} onChange={(e) => setParam(i, { userLabel: e.target.value })} /></div>
                    <div><span className={label}>Placeholder</span><input className={inputCls} value={p.userPlaceholder} onChange={(e) => setParam(i, { userPlaceholder: e.target.value })} /></div>
                    <div><span className={label}>Wrap</span><input className={`${inputCls} font-mono`} value={p.wrap} onChange={(e) => setParam(i, { wrap: e.target.value })} placeholder='exactly "{value}"' /></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Styles */}
        <div className={box}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Styles</p>
              <p className="text-xs text-gray-500">The menu [[STYLES]] turns into. Users can let the AI pick, or choose one.</p>
            </div>
            <button
              className={`${btnSecondary} inline-flex items-center gap-1.5`}
              onClick={() => set("styles", [...draft.styles, { key: String.fromCharCode(65 + draft.styles.length), name: "", description: "", bestFor: "" }])}
            >
              <Plus size={15} /> Add style
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {draft.styles.map((st, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex gap-3 items-end">
                  <div className="w-16"><span className={label}>Key</span><input className={`${inputCls} font-mono text-center`} value={st.key} onChange={(e) => setStyle(i, { key: e.target.value.toUpperCase() })} /></div>
                  <div className="flex-1"><span className={label}>Name</span><input className={inputCls} value={st.name} onChange={(e) => setStyle(i, { name: e.target.value })} /></div>
                  <div className="flex gap-1 mb-0.5">
                    <button className={btnSecondary} onClick={() => set("styles", move(draft.styles, i, -1))} aria-label="Up"><ArrowUp size={15} /></button>
                    <button className={btnSecondary} onClick={() => set("styles", move(draft.styles, i, 1))} aria-label="Down"><ArrowDown size={15} /></button>
                    <button className={btnSecondary} onClick={() => set("styles", draft.styles.filter((_, n) => n !== i))} aria-label="Remove"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div><span className={label}>What it looks like</span><textarea className={`${inputCls} h-20`} value={st.description} onChange={(e) => setStyle(i, { description: e.target.value })} /></div>
                <div><span className={label}>Best for</span><input className={inputCls} value={st.bestFor} onChange={(e) => setStyle(i, { bestFor: e.target.value })} /></div>
              </div>
            ))}
          </div>
        </div>

        </>
        )}

        <div className="flex justify-end">
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save template"}</button>
        </div>
      </div>

      {preview !== null && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="font-semibold text-gray-900">Final prompt (with defaults, AI picks the style)</p>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <pre className="flex-1 overflow-auto p-6 text-[13px] leading-relaxed whitespace-pre-wrap font-mono text-gray-800">{preview}</pre>
          </div>
        </div>
      )}
    </div>
  );
}


// ==================== Reference pack editor ====================
function PackEditor({ draft, setDraft, setMsg }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft | null>>; setMsg: (m: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "study" | null>(null);

  async function add(files: FileList | null) {
    if (!files) return;
    setBusy("upload");
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 12)) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(String(rd.result));
        rd.onerror = rej;
        rd.readAsDataURL(f);
      });
      const r = await fetch("/api/admin/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "uploadCover", dataUrl }) });
      const d = await r.json();
      if (r.ok) urls.push(d.url);
      else setMsg(d.error || "Upload failed");
    }
    setBusy(null);
    setDraft((cur) => (cur ? { ...cur, refImages: [...cur.refImages, ...urls].slice(0, 12), refDnas: [...cur.refDnas, ...urls.map(() => "")].slice(0, 12) } : cur));
    if (urls.length) setMsg("Reference ads added. Click 'Study pack' to write the DNA, then Save.");
  }

  async function study() {
    setBusy("study");
    setMsg(null);
    try {
      const r = await fetch("/api/admin/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "studyPack", refs: draft.refImages }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Study failed");
      setDraft((cur) => (cur ? { ...cur, packDna: d.packDna, refDnas: d.refDnas } : cur));
      setMsg("DNA written. Review it, then Save.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const remove = (i: number) =>
    setDraft((cur) => (cur ? { ...cur, refImages: cur.refImages.filter((_, n) => n !== i), refDnas: cur.refDnas.filter((_, n) => n !== i) } : cur));
  const setRefDna = (i: number, v: string) => setDraft((cur) => (cur ? { ...cur, refDnas: cur.refImages.map((_, n) => (n === i ? v : cur.refDnas[n] || "")) } : cur));

  return (
    <>
      <div className={box}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Reference ads</p>
            <p className="text-xs text-gray-500">Upload 1 or more ads. For each request the AI picks the best fit and rebuilds its layout with the user&apos;s brand colours, fonts, product and text.</p>
          </div>
          <div className="flex gap-2">
            <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => fileRef.current?.click()} disabled={!!busy}>
              {busy === "upload" ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add ads
            </button>
            <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={study} disabled={!!busy || draft.refImages.length === 0}>
              {busy === "study" ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} {draft.packDna ? "Re-study pack" : "Study pack"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </div>
        <div className="mt-4 space-y-3">
          {draft.refImages.map((src, i) => (
            <div key={src.slice(-40) + i} className="flex gap-4 rounded-xl border border-gray-200 p-3">
              <div className="relative w-28 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-28 rounded-lg border border-gray-200 object-cover" />
                <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/90">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className={label}>Layout DNA for ad {i + 1}</span>
                <textarea className={`${inputCls} h-28 font-mono text-[12px]`} value={draft.refDnas[i] || ""} onChange={(e) => setRefDna(i, e.target.value)} placeholder="Written by 'Study pack'" spellCheck={false} />
              </div>
              <button className={`${btnSecondary} self-start`} onClick={() => remove(i)} aria-label="Remove"><Trash2 size={15} /></button>
            </div>
          ))}
          {draft.refImages.length === 0 && <p className="text-sm text-gray-400">No reference ads yet.</p>}
        </div>
      </div>
      <div className={box}>
        <span className={label}>Pack DNA (what all the ads share)</span>
        <textarea className={`${inputCls} h-56 font-mono text-[12.5px] leading-relaxed`} value={draft.packDna} onChange={(e) => setDraft((cur) => (cur ? { ...cur, packDna: e.target.value } : cur))} placeholder="Written by 'Study pack'" spellCheck={false} />
      </div>
    </>
  );
}
