// ============================================================
// UXLLY — TikTok Slideshow Setup Wizard
// A stepped card flow (topic → slide count → CTA → references) that
// collects the config, then hands off to the AI slideshow page (/ai),
// where generation runs automatically and the movable-box editor opens.
// The config (and any uploaded references) travel via sessionStorage.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  LayoutGrid,
  Target,
  ImagePlus,
  X,
  Loader2,
} from "lucide-react";

// Shared with the AI page's auto-generate step.
export const TIKTOK_SETUP_KEY = "uxlly:tiktok-setup";

export interface TikTokSetup {
  channelId: string;
  topic: string;
  slideCount: number | "auto";
  ctaGoal: "save" | "follow" | "try_tool" | "none";
  referenceImages: string[]; // base64 data URLs uploaded for this run
}

interface ProjectOption {
  id: string;
  brandId: string;
  label: string;
  platform: string;
}

async function loadProjects(): Promise<ProjectOption[]> {
  try {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (!data.success) return [];
    const out: ProjectOption[] = [];
    for (const brand of data.data || []) {
      for (const ch of brand.channels || []) {
        out.push({ id: ch.id, brandId: brand.id, label: `${ch.name} · ${brand.name}`, platform: ch.platform });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// Downscales an uploaded image to a reference-sized JPEG data URL so it
// stays small enough for sessionStorage and fast to send.
function fileToScaledDataUrl(file: File, max = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const SLIDE_OPTIONS: { value: number | "auto"; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "5–7 slides, the playbook default" },
  { value: 5, label: "5 slides", hint: "Tight and punchy" },
  { value: 7, label: "7 slides", hint: "Room to build the point" },
  { value: 9, label: "9 slides", hint: "A fuller walkthrough" },
];

const CTA_OPTIONS: { value: TikTokSetup["ctaGoal"]; label: string; hint: string }[] = [
  { value: "save", label: "Save", hint: "Ask viewers to save it for later" },
  { value: "follow", label: "Follow", hint: "Ask viewers to follow for more" },
  { value: "try_tool", label: "Try the tool", hint: "Point to the link in bio" },
  { value: "none", label: "No CTA", hint: "Value only, no ask" },
];

const STEPS = ["Topic", "Slides", "Goal", "References"] as const;

interface TikTokWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Preselect this channel if provided (e.g. opened from a project). */
  initialChannelId?: string;
}

export default function TikTokWizard({ isOpen, onClose, initialChannelId }: TikTokWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [channelId, setChannelId] = useState("");
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState<number | "auto">("auto");
  const [ctaGoal, setCtaGoal] = useState<TikTokSetup["ctaGoal"]>("save");
  const [refs, setRefs] = useState<string[]>([]);
  const [refError, setRefError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingProjects(true);
    loadProjects().then((p) => {
      setProjects(p);
      setChannelId((prev) => prev || initialChannelId || p[0]?.id || "");
      setLoadingProjects(false);
    });
  }, [isOpen, initialChannelId]);

  // Reset to the first step whenever the wizard is opened fresh.
  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const canContinue =
    step === 0 ? !!channelId && topic.trim().length > 0 : true; // steps 1–3 always have a default

  const isLast = step === STEPS.length - 1;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setRefError(null);
    try {
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        if (!file.type.startsWith("image/")) continue;
        added.push(await fileToScaledDataUrl(file));
      }
      setRefs((prev) => [...prev, ...added].slice(0, 6));
    } catch {
      setRefError("One of those images couldn't be read. Try a different file.");
    }
  };

  const finish = () => {
    if (!channelId || !topic.trim()) {
      setStep(0);
      return;
    }
    setSubmitting(true);
    const setup: TikTokSetup = {
      channelId,
      topic: topic.trim(),
      slideCount,
      ctaGoal,
      referenceImages: refs,
    };
    try {
      sessionStorage.setItem(TIKTOK_SETUP_KEY, JSON.stringify(setup));
    } catch {
      // If storage is blocked, the AI page can't auto-run; fall back below.
    }
    onClose();
    router.push(`/ai?tiktok=1&channel=${encodeURIComponent(channelId)}`);
  };

  const next = () => {
    if (!canContinue) return;
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header: brand + progress */}
        <div className="px-7 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <div className="w-7 h-7 rounded-lg bg-pink-500 flex items-center justify-center">
                <Sparkles size={15} className="text-white" />
              </div>
              TikTok slideshow
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">Step {step + 1} of {STEPS.length}</span>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-pink-500" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-7 pb-2 min-h-[300px]">
          {/* ---- Step 1: Topic + project ---- */}
          {step === 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">What&apos;s your slideshow about?</h2>
              <p className="text-sm text-gray-500 mb-5">Name the hook or the reader&apos;s situation — the first slide promises a payoff from this.</p>

              <label className="text-xs font-medium text-gray-600 mb-1 block">Project</label>
              {loadingProjects ? (
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse mb-4" />
              ) : projects.length === 0 ? (
                <p className="text-sm text-gray-500 mb-4">
                  No projects yet. <a href="/projects" className="text-blue-600 hover:underline">Create one first.</a>
                </p>
              ) : (
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full mb-4 bg-white border border-gray-200 rounded-xl p-2.5 text-sm text-gray-800 outline-none focus:border-blue-400"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              )}

              <label className="text-xs font-medium text-gray-600 mb-1 block">Topic or hook angle</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. 5 review traps that quietly hurt your Amazon listing"
                rows={3}
                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-blue-400 resize-none"
              />
            </div>
          )}

          {/* ---- Step 2: Slide count ---- */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LayoutGrid size={18} className="text-gray-400" />
                <h2 className="text-2xl font-bold text-gray-900">How many slides?</h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">Auto follows the hook → value → close playbook.</p>
              <div className="grid grid-cols-2 gap-3">
                {SLIDE_OPTIONS.map((o) => {
                  const active = slideCount === o.value;
                  return (
                    <button
                      key={String(o.value)}
                      onClick={() => setSlideCount(o.value)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        active ? "border-pink-500 bg-pink-50 ring-1 ring-pink-500" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 text-sm">{o.label}</span>
                        {active && <Check size={16} className="text-pink-500" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{o.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---- Step 3: CTA ---- */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target size={18} className="text-gray-400" />
                <h2 className="text-2xl font-bold text-gray-900">What should viewers do?</h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">The last slide makes one clear ask.</p>
              <div className="grid grid-cols-2 gap-3">
                {CTA_OPTIONS.map((o) => {
                  const active = ctaGoal === o.value;
                  return (
                    <button
                      key={o.value}
                      onClick={() => setCtaGoal(o.value)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        active ? "border-pink-500 bg-pink-50 ring-1 ring-pink-500" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 text-sm">{o.label}</span>
                        {active && <Check size={16} className="text-pink-500" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{o.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---- Step 4: References ---- */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ImagePlus size={18} className="text-gray-400" />
                <h2 className="text-2xl font-bold text-gray-900">Add reference slides</h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                Optional. These guide the look for this slideshow, on top of your project&apos;s saved references.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <ImagePlus size={18} className="text-gray-400" />
                </div>
                <span className="text-sm font-medium text-gray-600">Click to upload reference images</span>
                <span className="text-xs text-gray-400">Up to 6 images</span>
              </button>

              {refError && <p className="text-xs text-red-500 mt-2">{refError}</p>}

              {refs.length > 0 && (
                <div className="grid grid-cols-6 gap-2 mt-3">
                  {refs.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="reference" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setRefs((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                        aria-label="Remove"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={step === 0 ? onClose : back}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            {step === 0 ? "Cancel" : (<><ArrowLeft size={14} /> Back</>)}
          </button>

          <div className="flex items-center gap-3">
            {isLast && (
              <button onClick={finish} className="text-sm font-medium text-gray-400 hover:text-gray-600">
                Skip references
              </button>
            )}
            <button
              onClick={next}
              disabled={!canContinue || submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" /> Starting…</>
              ) : isLast ? (
                <>Generate <ArrowRight size={15} /></>
              ) : (
                <>Continue <ArrowRight size={15} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
