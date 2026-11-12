// ============================================================
// UXLLY — Admin → Slideshows
// Build TikTok slideshow styles: upload example slides, let the AI study
// them into a DNA (photo look, scenes, caption voice, flow), pick the
// default caption look, publish.
// ============================================================
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { btnPrimary, btnSecondary, inputCls } from "@/components/billing/Shell";
import { FORMATS, type SlideshowStyleRec } from "@/lib/slideshow/types";

type Draft = Omit<SlideshowStyleRec, "id" | "usageCount"> & { id?: string; usageCount?: number };

const BLANK: Draft = { name: "New slideshow style", description: "", refs: [], dna: "", textStyle: "white", formats: [], published: false, sortOrder: 0 };
const label = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5";

function readFile(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export default function SlideshowStylesAdmin({ setMsg }: { setMsg: (m: string | null) => void }) {
  const [list, setList] = useState<SlideshowStyleRec[] | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (selectId?: string) => {
      const r = await fetch("/api/admin/slideshow-styles");
      const j = await r.json();
      if (!r.ok) return setMsg(j.error || "Could not load styles (did you add the SlideshowStyle table?)");
      setList(j.styles);
      const pick = j.styles.find((s: SlideshowStyleRec) => s.id === selectId) || j.styles[0];
      setD(pick ? structuredClone(pick) : structuredClone(BLANK));
    },
    [setMsg],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!list || !d) return <div className="mt-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  async function post(body: unknown) {
    const r = await fetch("/api/admin/slideshow-styles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Failed");
    return j;
  }

  async function save() {
    if (!d) return;
    setSaving(true);
    setMsg(null);
    try {
      const j = await post({ action: "save", id: d.id, style: d });
      setMsg(`"${j.style.name}" saved.`);
      await load(j.style.id);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!d?.id || !confirm(`Delete "${d.name}"?`)) return;
    await post({ action: "delete", id: d.id }).catch((e) => setMsg(e.message));
    await load();
  }

  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy("upload");
    const added: string[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      try {
        added.push((await post({ action: "upload", dataUrl: await readFile(f) })).url);
      } catch (e) {
        setMsg((e as Error).message);
      }
    }
    setD((cur) => (cur ? { ...cur, refs: [...cur.refs, ...added].slice(0, 12) } : cur));
    setBusy(null);
    if (added.length) setMsg("Examples added. Click 'Study examples' to write the DNA, then Save.");
  }

  async function study() {
    if (!d) return;
    setBusy("study");
    setMsg(null);
    try {
      const j = await post({ action: "study", refs: d.refs });
      setD((cur) => (cur ? { ...cur, dna: j.dna } : cur));
      setMsg("DNA written. Review it, then Save.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const toggleFormat = (k: string) => setD({ ...d, formats: d.formats.includes(k) ? d.formats.filter((x) => x !== k) : [...d.formats, k] });

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <div className="space-y-2">
        <button className={`${btnSecondary} w-full inline-flex items-center justify-center gap-1.5`} onClick={() => setD(structuredClone(BLANK))}>
          <Plus size={15} /> New style
        </button>
        {list.map((s) => (
          <button key={s.id} onClick={() => setD(structuredClone(s))} className={`w-full text-left rounded-xl border p-3 flex gap-3 items-center ${d.id === s.id ? "border-gray-900 bg-white" : "border-gray-200 bg-white/60 hover:bg-white"}`}>
            <div className="w-10 aspect-[3/4] rounded bg-gray-100 overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.refs[0] && <img src={s.refs[0]} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
              <p className="text-xs text-gray-500">{s.published ? (s.dna ? "Published" : "Published, no DNA yet") : "Draft"} · used {s.usageCount}×</p>
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input className={`${inputCls} max-w-md text-lg font-bold`} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800 mr-2">
              <input type="checkbox" checked={d.published} onChange={(e) => setD({ ...d, published: e.target.checked })} /> Published
            </label>
            {d.id && <button className={btnSecondary} onClick={remove} aria-label="Delete"><Trash2 size={15} /></button>}
            <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>

        <div>
          <span className={label}>Description (shown to users)</span>
          <input className={inputCls} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="e.g. Real phone photos, white caption boxes, first-person tips" />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <span className={label}>Default caption look</span>
            <select className={inputCls} value={d.textStyle} onChange={(e) => setD({ ...d, textStyle: e.target.value as Draft["textStyle"] })}>
              <option value="white">White box, dark text</option>
              <option value="dark">Dark box, white text</option>
              <option value="plain">Plain text, no box</option>
            </select>
          </div>
          <div>
            <span className={label}>Formats it suits (none ticked = all)</span>
            <div className="flex flex-wrap gap-3">
              {FORMATS.map((f) => (
                <label key={f.key} className="flex items-center gap-1.5 text-sm text-gray-800">
                  <input type="checkbox" checked={d.formats.includes(f.key)} onChange={() => toggleFormat(f.key)} /> {f.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Example slides</p>
              <p className="text-xs text-gray-500">3-6 slides from the style you love. Text on them is fine; the AI studies how captions look and are written, never copies the words.</p>
            </div>
            <div className="flex gap-2">
              <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => fileRef.current?.click()} disabled={!!busy}>
                {busy === "upload" ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add examples
              </button>
              <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={study} disabled={!!busy || d.refs.length === 0}>
                {busy === "study" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {d.dna ? "Re-study" : "Study examples"}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </div>
          {d.refs.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {d.refs.map((src, i) => (
                <div key={src.slice(-40) + i} className="relative w-24 aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setD({ ...d, refs: d.refs.filter((_, n) => n !== i) })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100" aria-label="Remove">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">No examples yet.</p>
          )}
          <div className="mt-4">
            <span className={label}>DNA (the AI follows this for every slideshow in this style; edit freely)</span>
            <textarea className={`${inputCls} h-56 font-mono text-[12.5px] leading-relaxed`} value={d.dna} onChange={(e) => setD({ ...d, dna: e.target.value })} placeholder="Add examples, then click 'Study examples' and the AI writes this." spellCheck={false} />
          </div>
        </div>

        <div className="flex justify-end">
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save style"}</button>
        </div>
      </div>
    </div>
  );
}
