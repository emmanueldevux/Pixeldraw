// ============================================================
// UXLLY — "Create my own carousel style" popup
// Name → first slide refs → middle slide refs → last slide refs.
// Images are resized in the browser, uploaded to storage, then the AI studies them.
// ============================================================
"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import WizardShell from "@/components/ui/WizardShell";
import { Field, LInput } from "@/components/ui/light";

const STEPS = [
  { id: "name", title: "Name your style", sub: "Something you'll recognise in the list." },
  { id: "intro", title: "First slide", sub: "Add 1–4 examples of cover slides you like." },
  { id: "details", title: "Middle slides", sub: "Add 1–4 examples of content slides." },
  { id: "outro", title: "Last slide", sub: "Add 1–4 examples of closing / follow slides." },
];
type Slot = "introRefs" | "detailsRefs" | "outroRefs";

function resize(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

export default function CarouselStyleWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [i, setI] = useState(0);
  const [name, setName] = useState("");
  const [refs, setRefs] = useState<Record<Slot, string[]>>({ introRefs: [], detailsRefs: [], outroRefs: [] });
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const slot: Slot | null = i === 1 ? "introRefs" : i === 2 ? "detailsRefs" : i === 3 ? "outroRefs" : null;

  async function add(files: FileList | null) {
    if (!files || !slot) return;
    setError("");
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 4 - refs[slot].length)) {
        const dataUrl = await resize(f);
        const r = await fetch("/api/carousel-styles/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Upload failed");
        setRefs((p) => ({ ...p, [slot]: [...p[slot], d.url] }));
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
      const r = await fetch("/api/carousel-styles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...refs }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not create the style");
      onCreated(d.style.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const disabled = i === 0 ? !name.trim() : !!slot && (refs[slot].length === 0 || uploading);

  return (
    <WizardShell
      heading="New carousel style"
      steps={STEPS}
      index={i}
      busy={busy}
      continueDisabled={disabled}
      finishLabel={busy ? "Studying your references…" : "Create style"}
      onBack={() => setI((x) => Math.max(0, x - 1))}
      onNext={() => (i === STEPS.length - 1 ? create() : setI((x) => x + 1))}
      onClose={onClose}
    >
      {i === 0 && (
        <Field label="Style name">
          <LInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bold editorial" autoFocus />
        </Field>
      )}
      {slot && (
        <div>
          <div className="grid grid-cols-4 gap-2">
            {refs[slot].map((src, k) => (
              <div key={src} className="relative aspect-[4/5] rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setRefs((p) => ({ ...p, [slot]: p[slot].filter((_, j) => j !== k) }))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {refs[slot].length < 4 && (
              <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="aspect-[4/5] rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 flex items-center justify-center">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              </button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {i === STEPS.length - 1 && !error && <p className="text-xs text-gray-500 mt-3">Creating the style uses a few credits while the AI studies your references.</p>}
    </WizardShell>
  );
}
