// ============================================================
// UXLLY — "Add a character" popup (the character sheet)
// A character keeps the same person on every slide. Two ways to make one:
//   upload  — 1-4 photos of a real person the user has the right to use
//   ai      — the AI invents a person from a description (a few credits)
// ============================================================
"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, Upload, Wand2, X } from "lucide-react";
import WizardShell from "@/components/ui/WizardShell";
import { Field, LInput, LTextarea } from "@/components/ui/light";
import { resizePhoto, uploadData } from "@/lib/slideshow/frames";
import type { Character } from "@/lib/slideshow/types";

const STEPS = [
  { id: "who", title: "Who is this?", sub: "A name and a short description keep them consistent." },
  { id: "photos", title: "Their photos", sub: "These tell the AI exactly what they look like." },
];

export default function CharacterWizard({ onClose, onCreated, onInsufficient }: { onClose: () => void; onCreated: (c: Character) => void; onInsufficient?: (neededMilli?: number) => void }) {
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<"upload" | "ai">("upload");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    if (!files) return;
    setError("");
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 4 - photos.length)) {
        const { viewUrl, url } = await uploadData(await resizePhoto(f, 1024));
        setPhotos((p) => [...p, url || viewUrl]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function makeAi() {
    setMaking(true);
    setError("");
    try {
      const r = await fetch("/api/slideshow/character", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 402) {
        onInsufficient?.(d.neededMilli);
        throw new Error("Not enough credits.");
      }
      if (!r.ok) throw new Error(d.error || "Could not make the character");
      setPhotos(d.photos || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMaking(false);
    }
  }

  const ready = photos.length > 0 && (mode === "ai" || consent);
  return (
    <WizardShell
      heading="New character"
      steps={STEPS}
      index={i}
      continueDisabled={i === 0 ? !name.trim() || (mode === "ai" && description.trim().length < 10) : !ready || uploading || making}
      finishLabel="Save character"
      onBack={() => setI((x) => Math.max(0, x - 1))}
      onNext={() => (i === STEPS.length - 1 ? onCreated({ id: `c${Date.now().toString(36)}`, name: name.trim(), description: description.trim(), photos, source: mode }) : setI((x) => x + 1))}
      onClose={onClose}
    >
      {i === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "upload", icon: <Upload className="w-4 h-4" />, t: "Upload photos", s: "A real person you have rights to" },
              { v: "ai", icon: <Wand2 className="w-4 h-4" />, t: "Make with AI", s: "An invented person, a few credits" },
            ] as const).map((o) => (
              <button key={o.v} type="button" onClick={() => { setMode(o.v); setPhotos([]); }} className={`text-left rounded-xl border p-3 ${mode === o.v ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">{o.icon}{o.t}</div>
                <p className="text-xs text-gray-500 mt-1">{o.s}</p>
              </button>
            ))}
          </div>
          <Field label="Name">
            <LInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada" />
          </Field>
          <Field label={mode === "ai" ? "Describe them" : "Notes (optional)"} hint={mode === "ai" ? "Age, hair, build, style, vibe. e.g. 26, shoulder-length wavy brown hair, warm smile, minimal black outfits" : "Anything the photos don't show: style, vibe"}>
            <LTextarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      )}
      {i === 1 && (
        <div className="space-y-3">
          {mode === "ai" && photos.length === 0 && (
            <button type="button" onClick={makeAi} disabled={making} className="w-full rounded-2xl border-2 border-dashed border-gray-300 hover:border-gray-400 py-12 flex flex-col items-center gap-2 text-gray-600">
              {making ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
              <span className="text-sm font-medium text-gray-900">{making ? "Making your character…" : "Make my character"}</span>
              <span className="text-xs">Two photos: a close-up and a half-body shot</span>
            </button>
          )}
          {(mode === "upload" || photos.length > 0) && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((src, k) => (
                <div key={src} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== k))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
                </div>
              ))}
              {mode === "upload" && photos.length < 4 && (
                <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 flex items-center justify-center">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
              )}
            </div>
          )}
          {mode === "ai" && photos.length > 0 && (
            <button type="button" onClick={() => { setPhotos([]); makeAi(); }} disabled={making} className="text-xs font-medium text-gray-600 hover:text-gray-900 underline">Try again (uses credits)</button>
          )}
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
          {mode === "upload" && (
            <>
              <p className="text-xs text-gray-500">Clear, well-lit photos of the face from different angles work best (1-4).</p>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I have the right to use this person&apos;s photos, and they agree to AI-made images of them.</span>
              </label>
            </>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </WizardShell>
  );
}
