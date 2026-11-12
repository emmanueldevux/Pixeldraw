// ============================================================
// UXLLY — "Create my own slideshow style" popup
// Name + caption look → 1-6 example slides. The AI studies them once.
// ============================================================
"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import WizardShell from "@/components/ui/WizardShell";
import { Field, LInput } from "@/components/ui/light";
import { resizePhoto, uploadData } from "@/lib/slideshow/frames";
import type { CaptionLook } from "@/lib/slideshow/types";

const STEPS = [
  { id: "name", title: "Name your style", sub: "And how captions should look by default." },
  { id: "refs", title: "Add example slides", sub: "1-6 slides from a slideshow you love. The AI studies the look, not the words." },
];

export default function SlideshowStyleWizard({ onClose, onCreated, onInsufficient }: { onClose: () => void; onCreated: (id: string) => void; onInsufficient?: (neededMilli?: number) => void }) {
  const [i, setI] = useState(0);
  const [name, setName] = useState("");
  const [look, setLook] = useState<CaptionLook>("white");
  const [refs, setRefs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    if (!files) return;
    setError("");
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 6 - refs.length)) {
        const { url } = await uploadData(await resizePhoto(f, 1000));
        setRefs((p) => [...p, url]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/slideshow/styles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, textStyle: look, refs }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 402) onInsufficient?.(d.neededMilli);
      if (!r.ok) throw new Error(d.error || "Could not create the style");
      onCreated(d.style.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <WizardShell
      heading="New slideshow style"
      steps={STEPS}
      index={i}
      busy={busy}
      continueDisabled={i === 0 ? !name.trim() : refs.length === 0 || uploading}
      finishLabel={busy ? "Studying your slides…" : "Create style"}
      onBack={() => setI((x) => Math.max(0, x - 1))}
      onNext={() => (i === STEPS.length - 1 ? create() : setI((x) => x + 1))}
      onClose={onClose}
    >
      {i === 0 && (
        <div className="space-y-4">
          <Field label="Style name">
            <LInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cozy first-person tips" autoFocus />
          </Field>
          <Field label="Caption look">
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "white", t: "White box", bg: "#fff", fg: "#111" },
                { v: "dark", t: "Dark box", bg: "rgba(0,0,0,.7)", fg: "#fff" },
                { v: "plain", t: "Plain text", bg: "transparent", fg: "#fff" },
              ] as const).map((o) => (
                <button key={o.v} type="button" onClick={() => setLook(o.v)} className={`rounded-xl border p-3 ${look === o.v ? "border-gray-900" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="rounded-lg h-12 flex items-center justify-center bg-gradient-to-br from-stone-500 to-stone-700">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ background: o.bg, color: o.fg, textShadow: o.v === "plain" ? "0 1px 3px rgba(0,0,0,.6)" : undefined }}>caption</span>
                  </div>
                  <p className="text-xs font-medium text-gray-800 mt-2">{o.t}</p>
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}
      {i === 1 && (
        <div>
          <div className="grid grid-cols-4 gap-2">
            {refs.map((src, k) => (
              <div key={src} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setRefs((p) => p.filter((_, j) => j !== k))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {refs.length < 6 && (
              <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 flex items-center justify-center">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              </button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
          <p className="text-xs text-gray-500 mt-3">Your style is private. Creating it uses a few credits.</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </WizardShell>
  );
}
