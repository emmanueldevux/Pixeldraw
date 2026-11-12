// ============================================================
// UXLLY — Admin → Carousels
// Build carousel styles: upload reference slides for Intro / Details /
// Outro, let the AI study each slot into a DNA, edit the DNA, publish.
// ============================================================
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
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

export default function CarouselStylesAdmin({ setMsg }: { setMsg: (m: string | null) => void }) {
  const [list, setList] = useState<CarouselStyle[] | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null); // "upload:intro" | "study:intro"

  const load = useCallback(
    async (selectId?: string) => {
      const r = await fetch("/api/admin/carousel-styles");
      const j = await r.json();
      if (!r.ok) return setMsg(j.error || "Could not load styles (did you add the CarouselStyle table?)");
      setList(j.styles);
      const pick = j.styles.find((s: CarouselStyle) => s.id === selectId) || j.styles[0];
      setD(pick ? structuredClone(pick) : structuredClone(BLANK));
    },
    [setMsg],
  );

  useEffect(() => {
    load();
  }, [load]);

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

  async function upload(slot: SlotKey, files: FileList | null) {
    if (!files) return;
    setBusySlot(`upload:${slot}`);
    const added: string[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      try {
        added.push((await post({ action: "upload", dataUrl: await readFile(f) })).url);
      } catch (e) {
        setMsg((e as Error).message);
      }
    }
    setD((cur) => (cur ? { ...cur, [`${slot}Refs`]: [...(cur[`${slot}Refs`] as string[]), ...added].slice(0, 12) } : cur));
    setBusySlot(null);
    if (added.length) setMsg("References added. Click 'Study references' to write the DNA, then Save.");
  }

  async function study(slot: SlotKey) {
    if (!d) return;
    setBusySlot(`study:${slot}`);
    setMsg(null);
    try {
      const j = await post({ action: "study", slot, refs: refs(slot) });
      setDna(slot, j.dna);
      setMsg(`${SLOT_LABEL[slot]} DNA written. Review it, then Save.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <div className="space-y-2">
        <button className={`${btnSecondary} w-full inline-flex items-center justify-center gap-1.5`} onClick={() => setD(structuredClone(BLANK))}>
          <Plus size={15} /> New style
        </button>
        {list.map((s) => (
          <button
            key={s.id}
            onClick={() => setD(structuredClone(s))}
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

        {SLOTS.map((slot) => (
          <SlotEditor
            key={slot}
            slot={slot}
            refs={refs(slot)}
            dna={dna(slot)}
            busy={busySlot}
            onUpload={(f) => upload(slot, f)}
            onRemove={(i) => setRefs(slot, refs(slot).filter((_, n) => n !== i))}
            onStudy={() => study(slot)}
            onDna={(v) => setDna(slot, v)}
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
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = p.busy === `upload:${p.slot}`;
  const studying = p.busy === `study:${p.slot}`;
  const hint: Record<SlotKey, string> = {
    intro: "The scroll-stopper. Add 3+ so intros vary between carousels.",
    details: "The middle pages. All details pages share one layout; only text and visual change.",
    outro: "The closing call to action.",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{SLOT_LABEL[p.slot]}</p>
          <p className="text-xs text-gray-500">{hint[p.slot]}</p>
        </div>
        <div className="flex gap-2">
          <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={() => fileRef.current?.click()} disabled={!!p.busy}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add references
          </button>
          <button className={`${btnSecondary} inline-flex items-center gap-1.5`} onClick={p.onStudy} disabled={!!p.busy || p.refs.length === 0}>
            {studying ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {p.dna ? "Re-study" : "Study references"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { p.onUpload(e.target.files); e.target.value = ""; }} />
      </div>

      {p.refs.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {p.refs.map((src, i) => (
            <div key={src.slice(-40) + i} className="relative w-24 aspect-[4/5] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button onClick={() => p.onRemove(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100" aria-label="Remove">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-400">No references yet.</p>
      )}

      <div className="mt-4">
        <span className={label}>DNA (the AI follows this for every {p.slot} slide; edit freely)</span>
        <textarea
          className={`${inputCls} h-56 font-mono text-[12.5px] leading-relaxed`}
          value={p.dna}
          onChange={(e) => p.onDna(e.target.value)}
          placeholder="Add references, then click 'Study references' and the AI writes this."
          spellCheck={false}
        />
      </div>
    </div>
  );
}
