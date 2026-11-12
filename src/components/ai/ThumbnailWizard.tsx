// ============================================================
// UXLLY — "Make a thumbnail" popup (light wizard, same look as the slideshow one)
//   1. Topic + project (optional)
//   2. Subject (character / your photo / let the AI), size, and text (none unless you want it)
//   3. Result: download or redo
// It calls the same chat endpoint the AI studio uses, so the thumbnail brain
// (reference packs, character sheet, size, no-text rule) is exactly the same.
// ============================================================
"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Plus, RefreshCw, X } from "lucide-react";
import WizardShell from "@/components/ui/WizardShell";
import LModal from "@/components/ui/LModal";
import { Chip, Field, LButton, LInput, LSelect, LTextarea } from "@/components/ui/light";
import { useBilling } from "@/components/billing/BillingProvider";
import type { Character } from "@/lib/slideshow/types";

const SIZES = [
  { key: "16:9", label: "16:9", hint: "YouTube" },
  { key: "1.91:1", label: "1.91:1", hint: "Blog, link preview" },
  { key: "3:2", label: "3:2", hint: "" },
  { key: "4:3", label: "4:3", hint: "" },
  { key: "1:1", label: "1:1", hint: "Square" },
  { key: "4:5", label: "4:5", hint: "Portrait" },
];
const RATIO: Record<string, string> = { "16:9": "16 / 9", "1.91:1": "1.91 / 1", "3:2": "3 / 2", "4:3": "4 / 3", "1:1": "1 / 1", "4:5": "4 / 5" };

const STEPS = [
  { id: "topic", title: "What's the thumbnail for?", sub: "A video, a blog post, an article. Say what it's about." },
  { id: "look", title: "Subject, size and text", sub: "Thumbnails have no text unless you want it." },
];

interface Project { brandId: string; platform: string; label: string; name: string }

async function loadProjects(): Promise<Project[]> {
  try {
    const d = await (await fetch("/api/projects")).json();
    const out: Project[] = [];
    for (const b of d.data || []) {
      const ch = (b.channels || [])[0];
      if (ch) out.push({ brandId: b.id, platform: ch.platform, label: b.name, name: b.name });
    }
    return out;
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

export default function ThumbnailWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { openTopUp, refresh } = useBilling();
  const [i, setI] = useState(0);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [brandId, setBrandId] = useState(""); // "" = no project (quick)
  const [topic, setTopic] = useState("");
  const [size, setSize] = useState("16:9");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [subject, setSubject] = useState<"auto" | "character" | "photo">("auto");
  const [characterId, setCharacterId] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [textMode, setTextMode] = useState<"none" | "write" | "exact">("none");
  const [textValue, setTextValue] = useState("");
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

  useEffect(() => {
    setCharacters([]);
    setCharacterId("");
    if (!brandId) return;
    fetch(`/api/slideshow/character?brandId=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((d) => {
        const c: Character[] = d.characters || [];
        setCharacters(c);
        if (c.length) {
          setSubject("character");
          setCharacterId(c[0].id);
        } else setSubject((s) => (s === "character" ? "auto" : s));
      })
      .catch(() => {});
  }, [brandId]);

  if (!isOpen) return null;
  const project = (projects || []).find((p) => p.brandId === brandId);

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

  async function pickPhoto(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    try {
      setPhoto(await resizePhoto(f));
      setSubject("photo");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function run(variation = false) {
    setBusy(true);
    setError("");
    const ch = characters.find((c) => c.id === characterId);
    const text =
      textMode === "exact" && textValue.trim() ? ` Add the text "${textValue.trim().replace(/"/g, "")}".` : textMode === "write" ? " Add a short bold title." : "";
    const content = `Make a thumbnail for ${topic.trim()}. Size ${size}.${text}${subject === "character" && ch ? ` Use ${ch.name}.` : ""}${variation ? "\n\nMake a completely different version: new composition, new pose and expression." : ""}`;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          platform: project?.platform || "instagram_post",
          brandId: project ? project.brandId : undefined,
          brandName: project?.name || "Free Chat",
          freeChat: !project,
          productImage: subject === "photo" && photo ? photo : undefined,
          characterId: subject === "character" ? characterId : "none",
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
      if (!res.ok || !d.imageUrl) throw new Error(d.error || "The thumbnail could not be made. Nothing was charged for a failed image. Try again.");
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
        title="Your thumbnail"
        sub={`${size}${project ? ` · ${project.name}` : ""}`}
        onClose={close}
        footer={
          <>
            <LButton variant="secondary" disabled={busy} icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} onClick={() => run(true)}>
              Redo thumbnail
            </LButton>
            <LButton variant="secondary" onClick={reset}>New thumbnail</LButton>
            <a href={result} download={`thumbnail-${size.replace(":", "x")}.png`} target="_blank" rel="noopener noreferrer">
              <LButton icon={<Download className="w-4 h-4" />}>Download</LButton>
            </a>
          </>
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result} alt="Thumbnail" className="w-full rounded-xl border border-gray-200" style={{ aspectRatio: RATIO[size] || "16 / 9", objectFit: "cover" }} />
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </LModal>
    );
  }

  const canNext = i === 0 ? topic.trim().length >= 3 : textMode !== "exact" || textValue.trim().length > 0;

  return (
    <WizardShell
      heading="Thumbnail"
      steps={STEPS}
      index={i}
      busy={busy}
      continueDisabled={!canNext}
      finishLabel={busy ? "Making your thumbnail…" : "Make thumbnail"}
      onBack={() => setI((x) => Math.max(0, x - 1))}
      onNext={() => (i === STEPS.length - 1 ? run() : setI((x) => x + 1))}
      onClose={close}
    >
      {i === 0 && (
        <div className="space-y-5">
          <Field label="Topic">
            <LTextarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. how I saved my first $10k, or 10 remote work tips" autoFocus />
          </Field>
          <LSelect
            label="Project"
            hint="Uses the project's thumbnail style, characters and brand colours."
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            options={[{ value: "", label: "No project (quick thumbnail)" }, ...(projects || []).map((p) => ({ value: p.brandId, label: p.label }))]}
          />
        </div>
      )}

      {i === 1 && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Who or what is in it?</p>
            <div className="flex flex-wrap gap-2">
              <Chip on={subject === "auto"} onClick={() => setSubject("auto")}>Let the AI decide</Chip>
              {characters.map((c) => (
                <Chip key={c.id} on={subject === "character" && characterId === c.id} onClick={() => { setSubject("character"); setCharacterId(c.id); }}>{c.name}</Chip>
              ))}
              <Chip on={subject === "photo"} onClick={() => (photo ? setSubject("photo") : fileRef.current?.click())}>
                {photo ? "My photo" : "Upload a photo"}
              </Chip>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files); e.target.value = ""; }} />
            {photo && (
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                <button type="button" onClick={() => { setPhoto(null); setSubject("auto"); }} className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1"><X className="w-3 h-3" /> Remove</button>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Change</button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">A photo can be a person or a product. The AI keeps faces and products exactly as they are.</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Size</p>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => (
                <Chip key={s.key} on={size === s.key} onClick={() => setSize(s.key)}>{s.label}{s.hint ? ` · ${s.hint}` : ""}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Text on the thumbnail</p>
            <div className="flex flex-wrap gap-2">
              <Chip on={textMode === "none"} onClick={() => setTextMode("none")}>No text</Chip>
              <Chip on={textMode === "write"} onClick={() => setTextMode("write")}>AI writes a short title</Chip>
              <Chip on={textMode === "exact"} onClick={() => setTextMode("exact")}>My own text</Chip>
            </div>
            {textMode === "exact" && (
              <div className="mt-3">
                <LInput value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="e.g. I QUIT MY JOB" maxLength={60} />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </WizardShell>
  );
}
