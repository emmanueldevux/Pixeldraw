// ============================================================
// UXLLY — Admin → Carousels
// Build carousel styles: drop a folder or many images, drag them onto
// Intro / Details / Outro (or Auto-sort), the AI studies each slot by itself,
// edit the DNA if you want, publish.
// ============================================================
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, ImagePlus, Loader2, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { btnPrimary, btnSecondary, inputCls } from "@/components/billing/Shell";
import { SLOTS, SLOT_LABEL, isUsable, type CarouselStyle, type SlotKey } from "@/lib/carousels/types";

type Draft = Omit<CarouselStyle, "id" | "usageCount"> & { id?: string; usageCount?: number };

const BLANK: Draft = {
  name: "New carousel style",
  description: "",
  published: false,
  sortOrder: 0,
  introRefs: [],
  introDna: "",
  detailsRefs: [],
  detailsDna: "",
  outroRefs: [],
  outroDna: "",
};

const label = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5";

async function readFile(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

// Natural order by name so slide_2 comes before slide_10 (folders keep their relative path).
function sortedImages(files: FileList | File[] | null): File[] {
  return Array.from(files || [])
    .filter((f) => f.type.startsWith("image/"))
    .sort((a, b) => ((a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name).localeCompare((b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name, undefined, { numeric: true }));
}
const sigOf = (d: { introRefs: string[]; detailsRefs: string[]; outroRefs: string[] }): Record<SlotKey, string> => ({ intro: d.introRefs.join("|"), details: d.detailsRefs.join("|"), outro: d.outroRefs.join("|") });
const DRAG = "application/x-carousel-ref";

export default function CarouselStylesAdmin({ setMsg }: { setMsg: (m: string | null) => void }) {
  const [list, setList] = useState<CarouselStyle[] | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null); // "upload:intro" | "study:intro" | "upload:tray"
  const [tray, setTray] = useState<string[]>([]); // uploaded, not placed on a slide yet
  const studiedSig = useRef<Record<SlotKey, string>>({ intro: "", details: "", outro: "" });
  const edited = useRef<Set<SlotKey>>(new Set()); // DNA the admin typed in: never overwritten automatically
  const studying = useRef(false); // a batch of automatic studies is running
  const folderRef = useRef<HTMLInputElement>(null);
  const trayFileRef = useRef<HTMLInputElement>(null);

  const adopt = useCallback((style: Draft) => {
    studiedSig.current = sigOf(style);
    edited.current = new Set();
    setTray([]);
    setD(style);
  }, []);

  const load = useCallback(
    async (selectId?: string) => {
      const r = await fetch("/api/admin/carousel-styles");
      const j = await r.json();
      if (!r.ok) return setMsg(j.error || "Could not load styles (did you add the CarouselStyle table?)");
      setList(j.styles);
      const pick = j.styles.find((s: CarouselStyle) => s.id === selectId) || j.styles[0];
      adopt(pick ? structuredClone(pick) : structuredClone(BLANK));
    },
    [setMsg, adopt],
  );

  useEffect(() => {
    load();
  }, [load]);

  // The AI studies a slot by itself a moment after its references change. A slot whose DNA
  // was typed by hand is left alone (use "Re-study" to rewrite it).
  useEffect(() => {
    if (!d) return;
    const now = sigOf(d);
    const todo = SLOTS.filter((sl) => now[sl] !== studiedSig.current[sl] && (d[`${sl}Refs`] as string[]).length > 0 && !edited.current.has(sl));
    SLOTS.forEach((sl) => { if (!(d[`${sl}Refs`] as string[]).length) studiedSig.current[sl] = now[sl]; });
    if (!todo.length || busySlot?.startsWith("study")) return;
    const t = setTimeout(() => { if (!studying.current) void studyMany(todo); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.introRefs, d?.detailsRefs, d?.outroRefs, busySlot]);

  if (!list || !d) return <div className="mt-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  const refs = (s: SlotKey) => d[`${s}Refs`] as string[];
  const setRefs = (s: SlotKey, v: string[]) => setD({ ...d, [`${s}Refs`]: v });
  const dna = (s: SlotKey) => d[`${s}Dna`] as string;
  const setDna = (s: SlotKey, v: string) => setD((cur) => (cur ? { ...cur, [`${s}Dna`]: v } : cur));

  async function post(body: unknown) {
    const r = await fetch("/api/admin/carousel-styles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    if (!d?.id || !confirm(`Delete "${d.name}"? Projects using it will fall back to another style.`)) return;
    await post({ action: "delete", id: d.id }).catch((e) => setMsg(e.message));
    await load();
  }

  // Upload many images (or a whole folder) in parallel, three at a time. They land in the tray
  // (or straight on a slot when dropped there).
  async function uploadFiles(files: File[], slot?: SlotKey) {
    const imgs = files.slice(0, 40);
    if (!imgs.length) return setMsg("No images found.");
    setBusySlot(`upload:${slot || "tray"}`);
    const urls: (string | null)[] = new Array(imgs.length).fill(null);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, imgs.length) }, async () => {
        while (next < imgs.length) {
          const i = next++;
          try { urls[i] = (await post({ action: "upload", dataUrl: await readFile(imgs[i]) })).url; } catch (e) { setMsg((e as Error).message); }
        }
      }),
    );
    const added = urls.filter((u): u is string => !!u);
    if (slot) setD((cur) => (cur ? { ...cur, [`${slot}Refs`]: [...(cur[`${slot}Refs`] as string[]), ...added].slice(0, 12) } : cur));
    else setTray((t) => [...t, ...added]);
    setBusySlot(null);
    if (added.length) setMsg(slot ? "Added. The AI will study this slide type in a moment." : `${added.length} image${added.length > 1 ? "s" : ""} added. Drag them onto Intro, Details or Outro, or press Auto-sort.`);
  }

  // Move one reference between the tray and the slots.
  function moveRef(src: string, from: SlotKey | "tray", to: SlotKey | "tray") {
    if (from === to) return;
    if (from === "tray") setTray((t) => t.filter((x) => x !== src));
    setD((cur) => {
      if (!cur) return cur;
      const nd = { ...cur } as Draft;
      if (from !== "tray") (nd as Record<string, unknown>)[`${from}Refs`] = (cur[`${from}Refs`] as string[]).filter((x) => x !== src);
      if (to !== "tray") (nd as Record<string, unknown>)[`${to}Refs`] = [...(cur[`${to}Refs`] as string[]).filter((x) => x !== src), src].slice(0, 12);
      return nd;
    });
    if (to === "tray") setTray((t) => (t.includes(src) ? t : [...t, src]));
  }

  // First picture is the intro, the last is the outro, everything between is details.
  function autoSort() {
    if (!tray.length) return;
    const all = [...tray];
    setD((cur) => {
      if (!cur) return cur;
      const intro = all.length > 1 ? [all[0]] : all;
      const outro = all.length > 2 ? [all[all.length - 1]] : [];
      const mid = all.length > 2 ? all.slice(1, -1) : all.length === 2 ? [all[1]] : [];
      return { ...cur, introRefs: [...cur.introRefs, ...intro].slice(0, 12), detailsRefs: [...cur.detailsRefs, ...mid].slice(0, 12), outroRefs: [...cur.outroRefs, ...outro].slice(0, 12) };
    });
    setTray([]);
  }

  async function studyMany(slots: SlotKey[]) {
    studying.current = true;
    try { for (const sl of slots) await study(sl, true); } finally { studying.current = false; }
  }

  async function study(slot: SlotKey, auto = false) {
    if (!d) return;
    setBusySlot(`study:${slot}`);
    if (!auto) setMsg(null);
    const sig = (d[`${slot}Refs`] as string[]).join("|");
    try {
      const j = await post({ action: "study", slot, refs: refs(slot) });
      setDna(slot, j.dna);
      studiedSig.current[slot] = sig;
      edited.current.delete(slot);
      setMsg(`${SLOT_LABEL[slot]} DNA written. Review it, then Save.`);
    } catch (e) {
      studiedSig.current[slot] = sig; // don't retry in a loop; Re-study is one click
      setMsg(`${SLOT_LABEL[slot]}: ${(e as Error).message}`);
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <div className="space-y-2">
        <button className={`${btnSecondary} w-full inline-flex items-center justify-center gap-1.5`} onClick={() => adopt(structuredClone(BLANK))}>
          <Plus size={15} /> New style
        </button>
        {list.map((s) => (
          <button
            key={s.id}
            onClick={() => adopt(structuredClone(s))}
            className={`w-full text-left rounded-xl border p-3 flex gap-3 items-center ${d.id === s.id ? "border-gray-900 bg-white" : "border-gray-200 bg-white/60 hover:bg-white"}`}
          >
            <div className="w-10 aspect-[4/5] rounded bg-gray-100 overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.introRefs[0] && <img src={s.introRefs[0]} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
              <p className="text-xs text-gray-500">{s.published ? (isUsable(s) ? "Published" : "Published, slots missing") : "Draft"} · used {s.usageCount}×</p>
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
          <span className={label}>Description (shown to users when they pick a style)</span>
          <input className={inputCls} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="e.g. Clean editorial, serif titles, line illustrations" />
        </div>
        {d.published && !isUsable(d) && (
          <p className="text-sm text-amber-700">Every slot needs at least one reference before users can get this style.</p>
        )}

        <div
          className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const moved = e.dataTransfer.getData(DRAG);
            if (moved) { const m = JSON.parse(moved) as { src: string; from: SlotKey | "tray" }; moveRef(m.src, m.from, "tray"); return; }
            void uploadFiles(sortedImages(e.dataTransfer.files));
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Add many at once</p>
              <p className="text-xs text-gray-500">Drop images here, or choose a folder. They are put in order by file name. Then drag each one onto Intro, Details or Outro, or press Auto-sort.</p>
            </div>
            <div className="flex gap-2">
              <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => trayFileRef.current?.click()} disabled={!!busySlot}>
                {busySlot === "upload:tray" ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Choose images
              </button>
              <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => folderRef.current?.click()} disabled={!!busySlot}>
                <FolderOpen size={15} /> Choose folder
              </button>
              {tray.length > 0 && (
                <button className={`${btnPrimary} inline-flex items-center gap-1.5`} onClick={autoSort}><Wand2 size={15} /> Auto-sort</button>
              )}
            </div>
            <input ref={trayFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void uploadFiles(sortedImages(e.target.files)); e.target.value = ""; }} />
            <input ref={folderRef} type="file" accept="image/*" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => { void uploadFiles(sortedImages(e.target.files)); e.target.value = ""; }} />
          </div>
          {tray.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {tray.map((src, i) => (
                <div key={src.slice(-40) + i} draggable onDragStart={(e) => e.dataTransfer.setData(DRAG, JSON.stringify({ src, from: "tray" }))} className="relative w-24 aspect-[4/5] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 cursor-grab group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" />
                  <button onClick={() => setTray((t) => t.filter((x) => x !== src))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100" aria-label="Remove"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {SLOTS.map((slot) => (
          <SlotEditor
            key={slot}
            slot={slot}
            refs={refs(slot)}
            dna={dna(slot)}
            busy={busySlot}
            onUpload={(f) => void uploadFiles(sortedImages(f), slot)}
            onRemove={(i) => setRefs(slot, refs(slot).filter((_, n) => n !== i))}
            onStudy={() => void study(slot)}
            onDna={(v) => { edited.current.add(slot); setDna(slot, v); }}
            onDropRef={(src, from) => moveRef(src, from, slot)}
            onDropFiles={(f) => void uploadFiles(sortedImages(f), slot)}
          />
        ))}

        <div className="flex justify-end">
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save style"}</button>
        </div>
      </div>
    </div>
  );
}

function SlotEditor(p: {
  slot: SlotKey;
  refs: string[];
  dna: string;
  busy: string | null;
  onUpload: (f: FileList | null) => void;
  onRemove: (i: number) => void;
  onStudy: () => void;
  onDna: (v: string) => void;
  onDropRef: (src: string, from: SlotKey | "tray") => void;
  onDropFiles: (f: File[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = p.busy === `upload:${p.slot}`;
  const studying = p.busy === `study:${p.slot}`;
  const hint: Record<SlotKey, string> = {
    intro: "Slide 1, the scroll-stopper. Add 3+ so intros vary between carousels.",
    details: "The middle slides. All details pages share one layout; only text and visual change.",
    outro: "The last slide, the closing call to action.",
  };
  const [over, setOver] = useState(false);
  return (
    <div
      className={`rounded-xl border bg-white p-5 transition-colors ${over ? "border-gray-900 ring-2 ring-gray-900/10" : "border-gray-200"}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const moved = e.dataTransfer.getData(DRAG);
        if (moved) { const m = JSON.parse(moved) as { src: string; from: SlotKey | "tray" }; p.onDropRef(m.src, m.from); return; }
        if (e.dataTransfer.files.length) p.onDropFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{SLOT_LABEL[p.slot]}</p>
          <p className="text-xs text-gray-500">{hint[p.slot]}</p>
        </div>
        <div className="flex gap-2">
          <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => fileRef.current?.click()} disabled={!!p.busy}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add references
          </button>
          {(studying || p.dna) && (
            <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={p.onStudy} disabled={!!p.busy || p.refs.length === 0} title="Rewrite the DNA from the current references">
              {studying ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {studying ? "Studying…" : "Re-study"}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { p.onUpload(e.target.files); e.target.value = ""; }} />
      </div>

      {p.refs.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {p.refs.map((src, i) => (
            <div key={src.slice(-40) + i} draggable onDragStart={(e) => e.dataTransfer.setData(DRAG, JSON.stringify({ src, from: p.slot }))} className="relative w-24 aspect-[4/5] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group cursor-grab">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" />
              <button onClick={() => p.onRemove(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100" aria-label="Remove">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-400">No references yet. Drag images here or press Add references.</p>
      )}

      <div className="mt-4">
        <span className={label}>DNA (the AI follows this for every {p.slot} slide; edit freely)</span>
        <textarea
          className={`${inputCls} h-56 font-mono text-[12.5px] leading-relaxed`}
          value={p.dna}
          onChange={(e) => p.onDna(e.target.value)}
          placeholder="Add references and the AI writes this by itself."
          spellCheck={false}
        />
      </div>
    </div>
  );
}
