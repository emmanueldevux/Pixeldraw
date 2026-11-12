// ============================================================
// UXLLY — "Make an ad" popup (light wizard, same look as the slideshow one)
//   1. Project + what the ad is for
//   2. Headline (optional), product photo (optional), format
//   3. Result: download or redo
// Uses the same chat endpoint as the AI studio, so the ad brain (the
// project's reference pack, copy frameworks, brand voice) is identical.
// ============================================================
"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Plus, RefreshCw, X } from "lucide-react";
import WizardShell from "@/components/ui/WizardShell";
import LModal from "@/components/ui/LModal";
import { Chip, Field, LButton, LInput, LSelect, LTextarea } from "@/components/ui/light";
import { useBilling } from "@/components/billing/BillingProvider";

const FORMATS = [
  { key: "instagram_portrait", label: "4:5", hint: "Feed portrait", ratio: "4 / 5" },
  { key: "instagram_post", label: "1:1", hint: "Square", ratio: "1 / 1" },
  { key: "instagram_story", label: "9:16", hint: "Story / Reel", ratio: "9 / 16" },
  { key: "twitter", label: "16:9", hint: "Wide", ratio: "16 / 9" },
  { key: "linkedin_post", label: "1.91:1", hint: "LinkedIn / link", ratio: "1.91 / 1" },
];

const STEPS = [
  { id: "brief", title: "What's the ad for?", sub: "A product, an offer, an announcement. The AI picks the best layout and writes the words." },
  { id: "look", title: "Details and format", sub: "All optional except the format." },
];

interface Project { brandId: string; label: string; name: string }

async function loadProjects(): Promise<Project[]> {
  try {
    const d = await (await fetch("/api/projects")).json();
    return (d.data || []).map((b: { id: string; name: string }) => ({ brandId: b.id, label: b.name, name: b.name }));
  } catch {
    return [];
  }
}

function resizePhoto(file: File, max = 1280): Promise<string> {
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
      resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

export default function AdWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { openTopUp, refresh } = useBilling();
  const [i, setI] = useState(0);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [brandId, setBrandId] = useState("");
  const [brief, setBrief] = useState("");
  const [headline, setHeadline] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [format, setFormat] = useState("instagram_portrait");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadProjects().then((p) => {
      setProjects(p);
      setBrandId((cur) => cur || p[0]?.brandId || "");
    });
  }, [isOpen]);

  if (!isOpen) return null;
  const project = (projects || []).find((p) => p.brandId === brandId);
  const fmt = FORMATS.find((f) => f.key === format) || FORMATS[0];

  const reset = () => {
    setI(0);
    setResult(null);
    setError("");
    setBusy(false);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  async function run(variation = false) {
    setBusy(true);
    setError("");
    const content = `Make an ad for ${brief.trim()}.${headline.trim() ? ` Headline: "${headline.trim().replace(/"/g, "")}".` : ""}${variation ? "\n\nMake a completely different version: a different layout and look." : ""}`;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          platform: format,
          brandId: project ? project.brandId : undefined,
          brandName: project?.name || "Free Chat",
          freeChat: !project,
          productImage: photo || undefined,
          imageProvider: "openai",
        }),
      });
      if (res.status === 402) {
        const d = await res.json().catch(() => ({}));
        openTopUp({ reason: "out_of_credits", neededMilli: d.neededMilli });
        setBusy(false);
        return;
      }
      const d = await res.json();
      refresh?.();
      if (!res.ok || !d.imageUrl) throw new Error(d.error || "The ad could not be made. Try again.");
      setResult(d.imageUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <LModal
        wide
        title="Your ad"
        sub={`${fmt.label}${project ? ` · ${project.name}` : ""}. It's saved to your Files.`}
        onClose={close}
        footer={
          <>
            <LButton variant="secondary" disabled={busy} icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} onClick={() => run(true)}>
              Redo ad
            </LButton>
            <LButton variant="secondary" onClick={reset}>New ad</LButton>
            <a href={result} download="ad.png" target="_blank" rel="noopener noreferrer">
              <LButton icon={<Download className="w-4 h-4" />}>Download</LButton>
            </a>
          </>
        }
      >
        <div className="max-w-sm mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result} alt="Ad" className="w-full rounded-xl border border-gray-200" style={{ aspectRatio: fmt.ratio, objectFit: "cover" }} />
        </div>
        {error && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}
      </LModal>
    );
  }

  const canNext = i === 0 ? brief.trim().length >= 3 : true;

  return (
    <WizardShell
      heading="Ad"
      steps={STEPS}
      index={i}
      busy={busy}
      continueDisabled={!canNext}
      finishLabel={busy ? "Making your ad…" : "Make ad"}
      onBack={() => setI((x) => Math.max(0, x - 1))}
      onNext={() => (i === STEPS.length - 1 ? run() : setI((x) => x + 1))}
      onClose={close}
    >
      {i === 0 && (
        <div className="space-y-5">
          <LSelect
            label="Project"
            hint="A project brings your brand colours, voice and ad style. Skip it for a quick ad."
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            options={[...(projects || []).map((p) => ({ value: p.brandId, label: p.label })), { value: "", label: "No project (quick ad)" }]}
          />
          <Field label="What's the ad for?">
            <LTextarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. weekend sale, 20% off all sneakers" autoFocus />
          </Field>
        </div>
      )}

      {i === 1 && (
        <div className="space-y-6">
          <LInput label="Headline (optional)" hint="Leave empty and the AI writes one." value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} />

          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Product photo (optional)</p>
            {photo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                <button type="button" onClick={() => setPhoto(null)} className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1"><X className="w-3 h-3" /> Remove</button>
              </div>
            ) : (
              <LButton variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>Add a photo</LButton>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) try { setPhoto(await resizePhoto(f)); } catch (err) { setError((err as Error).message); } }} />
            <p className="text-xs text-gray-500 mt-2">The AI reproduces your product exactly as it is.</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Format</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Chip key={f.key} on={format === f.key} onClick={() => setFormat(f.key)}>{f.label} · {f.hint}</Chip>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </WizardShell>
  );
}
