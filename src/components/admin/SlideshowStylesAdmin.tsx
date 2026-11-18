// ============================================================
// UXLLY — Admin → Slideshows
// Build TikTok slideshow styles: upload example slides, let the AI study
// them into a DNA (photo look, scenes, caption voice, flow), pick the
// default caption look, publish.
// ============================================================
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { CoverStar, ExtraPrompt } from "@/components/admin/CoverExtra";
import { btnPrimary, btnSecondary, inputCls } from "@/components/billing/Shell";
import { FORMATS, type SlideshowStyleRec } from "@/lib/slideshow/types";

type Draft = Omit<SlideshowStyleRec, "id" | "usageCount"> & { id?: string; usageCount?: number };

const BLANK: Draft = { name: "New slideshow style", description: "", refs: [], dna: "", coverImage: "", extraPrompt: "", textStyle: "white", formats: [], published: false, sortOrder: 0 };
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
  const folderRef = useRef<HTMLInputElement>(null);
  const studiedSig = useRef("");
  const edited = useRef(false); // DNA typed by hand is never overwritten automatically
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const load = useCallback(
    async (selectId?: string) => {
      const r = await fetch("/api/admin/slideshow-styles");
      const j = await r.json();
      if (!r.ok) return setMsg(j.error || "Could not load styles (did you add the SlideshowStyle table?)");
      setList(j.styles);
      const pick = j.styles.find((s: SlideshowStyleRec) => s.id === selectId) || j.styles[0];
      const next: Draft = pick ? structuredClone(pick) : structuredClone(BLANK);
      studiedSig.current = next.refs.join("|");
      edited.current = false;
      setD(next);
    },
    [setMsg],
  );
  useEffect(() => {
    load();
  }, [load]);

  // The AI studies the examples by itself a moment after they change (unless the DNA was typed by hand).
  useEffect(() => {
    if (!d || busy) return;
    const sig = d.refs.join("|");
    if (sig === studiedSig.current) return;
    if (!d.refs.length || edited.current) { studiedSig.current = sig; return; }
    const t = setTimeout(() => { void study(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.refs, busy]);

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

  // Many images or a whole folder: put in order by file name.
  async function upload(files: FileList | File[] | null) {
    const imgs = Array.from(files || [])
      .filter((f) => f.type.startsWith("image/"))
      .sort((a, b) => ((a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name).localeCompare((b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name, undefined, { numeric: true }))
      .slice(0, 12);
    if (!imgs.length) return setMsg("No images found.");
    setBusy("upload");
    const added: string[] = [];
    for (const f of imgs) {
      try {
        added.push((await post({ action: "upload", dataUrl: await readFile(f) })).url);
      } catch (e) {
        setMsg((e as Error).message);
      }
    }
    setD((cur) => (cur ? { ...cur, refs: [...cur.refs, ...added].slice(0, 12) } : cur));
    setBusy(null);
    if (added.length) setMsg("Examples added. The AI will study them in a moment.");
  }

  // Drag one example onto another to change the slide order.
  function reorder(from: number, to: number) {
    setD((cur) => {
      if (!cur || from === to) return cur;
      const refs = [...cur.refs];
      const [m] = refs.splice(from, 1);
      refs.splice(to, 0, m);
      return { ...cur, refs };
    });
  }

  async function study() {
    if (!d) return;
    setBusy("study");
    setMsg(null);
    const sig = d.refs.join("|");
    try {
      const j = await post({ action: "study", refs: d.refs });
      setD((cur) => (cur ? { ...cur, dna: j.dna } : cur));
      edited.current = false;
      setMsg("DNA written. Review it, then Save.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      studiedSig.current = sig;
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
              {(s.coverImage || s.refs[0]) && <img src={s.coverImage || s.refs[0]} alt="" className="w-full h-full object-cover" />}
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

        <ExtraPrompt value={d.extraPrompt || ""} onChange={(v) => setD({ ...d, extraPrompt: v })} />

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

        <div
          className="rounded-xl border border-gray-200 bg-white p-5"
          onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
          onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); void upload(e.dataTransfer.files); } }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Example slides</p>
              <p className="text-xs text-gray-500">3-6 slides from the style you love, in order (drag to reorder). Drop images here or choose a folder. The AI studies them by itself; it never copies the words.</p>
            </div>
            <div className="flex gap-2">
              <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => fileRef.current?.click()} disabled={!!busy}>
                {busy === "upload" ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add examples
              </button>
              <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => folderRef.current?.click()} disabled={!!busy}>
                <FolderOpen size={15} /> Choose folder
              </button>
              {(busy === "study" || d.dna) && (
                <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => void study()} disabled={!!busy || d.refs.length === 0} title="Rewrite the DNA from the current examples">
                  {busy === "study" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy === "study" ? "Studying…" : "Re-study"}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
            <input ref={folderRef} type="file" accept="image/*" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
          </div>
          {d.refs.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {d.refs.map((src, i) => (
                <div
                  key={src.slice(-40) + i}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => { if (dragFrom !== null) e.preventDefault(); }}
                  onDrop={(e) => { if (dragFrom !== null) { e.preventDefault(); e.stopPropagation(); reorder(dragFrom, i); setDragFrom(null); } }}
                  className="relative w-24 aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group cursor-grab"
                >
                  <span className="absolute bottom-1 left-1 z-10 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" />
                  <CoverStar on={d.coverImage ? d.coverImage === src : i === 0} onPick={() => setD({ ...d, coverImage: src })} />
                  <button onClick={() => setD({ ...d, refs: d.refs.filter((_, n) => n !== i) })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100" aria-label="Remove">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">No examples yet. Drop images here or choose a folder.</p>
          )}
          <div className="mt-4">
            <span className={label}>DNA (the AI follows this for every slideshow in this style; edit freely)</span>
            <textarea className={`${inputCls} h-56 font-mono text-[12.5px] leading-relaxed`} value={d.dna} onChange={(e) => { edited.current = true; setD({ ...d, dna: e.target.value }); }} placeholder="Add examples and the AI writes this by itself." spellCheck={false} />
          </div>
        </div>

        <div className="flex justify-end">
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save style"}</button>
        </div>
      </div>
    </div>
  );
}
