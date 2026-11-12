// ============================================================
// UXLLY — "Create my own ad pack" popup
// Name → 1-8 reference ads. Images are resized in the browser, uploaded to
// storage, then the AI studies them once (layout, copy pattern, mood, best for).
// ============================================================
"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import WizardShell from "@/components/ui/WizardShell";
import { Field, LInput } from "@/components/ui/light";

const stepsFor = (thumb: boolean) => [
  { id: "name", title: "Name your pack", sub: "Something you'll recognise in the list." },
  thumb
    ? { id: "refs", title: "Add reference thumbnails", sub: "Up to 8 thumbnails whose look you love. The AI studies composition, expression and colour once." }
    : { id: "refs", title: "Add reference ads", sub: "Up to 8 ads whose look and layout you love. The AI studies them once." },
];

function resize(file: File, max = 1100): Promise<string> {
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
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

export default function AdPackWizard({ onClose, onCreated, purpose = "ad" }: { onClose: () => void; onCreated: (id: string) => void; purpose?: "ad" | "thumbnail" }) {
  const thumb = purpose === "thumbnail";
  const STEPS = stepsFor(thumb);
  const [i, setI] = useState(0);
  const [name, setName] = useState("");
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
      for (const f of Array.from(files).slice(0, 8 - refs.length)) {
        const dataUrl = await resize(f);
        const r = await fetch("/api/carousel-styles/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Upload failed");
        setRefs((p) => [...p, d.url]);
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
      const r = await fetch("/api/ad-packs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, refs, purpose }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not create the pack");
      onCreated(d.pack.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <WizardShell
      heading={thumb ? "New thumbnail pack" : "New ad pack"}
      steps={STEPS}
      index={i}
      busy={busy}
      continueDisabled={i === 0 ? !name.trim() : refs.length === 0 || uploading}
      finishLabel={busy ? "Studying your ads…" : "Create pack"}
      onBack={() => setI((x) => Math.max(0, x - 1))}
      onNext={() => (i === STEPS.length - 1 ? create() : setI((x) => x + 1))}
      onClose={onClose}
    >
      {i === 0 && (
        <Field label="Pack name">
          <LInput value={name} onChange={(e) => setName(e.target.value)} placeholder={thumb ? "e.g. Bold YouTube thumbnails" : "e.g. Bold promo ads"} autoFocus />
        </Field>
      )}
      {i === 1 && (
        <div>
          <div className="grid grid-cols-4 gap-2">
            {refs.map((src, k) => (
              <div key={src} className={`relative ${thumb ? "aspect-video" : "aspect-[4/5]"} rounded-lg overflow-hidden border border-gray-200`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setRefs((p) => p.filter((_, j) => j !== k))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {refs.length < 8 && (
              <button type="button" onClick={() => input.current?.click()} disabled={uploading} className={`${thumb ? "aspect-video" : "aspect-[4/5]"} rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 flex items-center justify-center`}>
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              </button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
          <p className="text-xs text-gray-500 mt-3">Your pack is private. When you have your own packs, they are used instead of ours. Creating it uses a few credits.</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </WizardShell>
  );
}
