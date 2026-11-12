// ============================================================
// UXLLY — Quick Create modals (Dashboard)
// Two separate modals: a carousel and a TikTok slideshow. Each picks a
// project, generates through the carousel API, and shows the result in
// its own modal. They don't depend on the AI Studio chat.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import WizardShell from "@/components/ui/WizardShell";
import OnboardingModal from "@/components/projects/OnboardingModal";
import LModal from "@/components/ui/LModal";
import { Chip, Field, LButton, LInput, LSelect, LTextarea } from "@/components/ui/light";
import TikTokSlideEditor, { type TikTokDisclosure } from "@/components/ai/TikTokSlideEditor";
import TikTokSlideshowModal, {
  type TikTokCtaGoal,
  type TikTokSlideshowParams,
} from "@/components/ai/TikTokSlideshowModal";
import type { CarouselSlideMessage } from "@/types";

interface ProjectOption {
  id: string; // channel id
  brandId: string;
  label: string;
  platform: string;
}

interface GenerationResult {
  slides: CarouselSlideMessage[];
  disclosure: TikTokDisclosure | null;
}

const TIKTOK_CTA_TEXT: Record<TikTokCtaGoal, string | undefined> = {
  save: "Save this for your next check.",
  follow: "Follow for the next tip.",
  try_tool: "Try it from the link in bio.",
  none: undefined,
};

async function loadProjects(): Promise<ProjectOption[]> {
  try {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (!data.success) return [];
    const out: ProjectOption[] = [];
    for (const brand of data.data || []) {
      for (const ch of brand.channels || []) {
        out.push({
          id: ch.id,
          brandId: brand.id,
          label: `${ch.name} · ${brand.name}`,
          platform: ch.platform,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function generateSlides(body: Record<string, unknown>): Promise<GenerationResult> {
  const res = await fetch("/api/ai/carousel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Generation failed. Please try again.");
  return { slides: data.data.slides, disclosure: data.data.disclosure ?? null };
}

// ==================== Carousel (light wizard, same look as the slideshow one) ====================
const CAROUSEL_STEPS = [
  { id: "topic", title: "What's the carousel about?", sub: "The hook, the flow and the call to action are planned from this." },
  { id: "options", title: "Length and goal", sub: "Let the AI decide, or set it yourself." },
];

export function CarouselQuickModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState("auto");
  const [ctaGoal, setCtaGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<CarouselSlideMessage[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    loadProjects().then((opts) => {
      setProjects(opts);
      setProjectId((cur) => cur || opts[0]?.id || "");
    });
  }, [isOpen, reload]);

  if (!isOpen) return null;
  const project = (projects || []).find((p) => p.id === projectId);

  const handleClose = () => {
    if (loading) return;
    setSlides(null);
    setError(null);
    setI(0);
    onClose();
  };

  const run = async () => {
    if (!project || !topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateSlides({
        brandId: project.brandId,
        topic: topic.trim(),
        platform: project.platform,
        slideCount: slideCount === "auto" ? undefined : parseInt(slideCount, 10),
        ctaGoal: ctaGoal.trim() || undefined,
        format: "carousel",
      });
      setSlides(result.slides);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (slides) {
    return (
      <LModal
        wide
        title="Your carousel"
        sub={`${slides.length} slides`}
        onClose={handleClose}
        footer={
          <>
            <LButton variant="secondary" onClick={() => { setSlides(null); setI(0); }}>Create another</LButton>
            <LButton onClick={handleClose}>Done</LButton>
          </>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {slides.map((s) => (
            <div key={s.slideNumber} className="space-y-1.5">
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUrl} alt={`Slide ${s.slideNumber}`} className="rounded-xl w-full border border-gray-200" />
              ) : (
                <div className="aspect-[4/5] flex items-center justify-center rounded-xl bg-gray-100 text-xs text-red-500">failed</div>
              )}
              {s.imageUrl && (
                <a href={s.imageUrl} download={`carousel-slide-${s.slideNumber}.png`} className="text-xs font-medium text-gray-600 hover:text-gray-900">
                  Download slide {s.slideNumber}
                </a>
              )}
            </div>
          ))}
        </div>
      </LModal>
    );
  }

  const noProjects = projects !== null && projects.length === 0;
  const canNext = i === 0 ? !!project && topic.trim().length >= 4 : true;

  return (
    <WizardShell
      heading="Carousel"
      steps={CAROUSEL_STEPS}
      index={i}
      busy={loading}
      continueDisabled={!canNext}
      finishLabel={loading ? "Making your carousel…" : "Make carousel"}
      onBack={() => setI((x) => Math.max(0, x - 1))}
      onNext={() => (i === CAROUSEL_STEPS.length - 1 ? run() : setI((x) => x + 1))}
      onClose={handleClose}
    >
      {i === 0 && (
        <div className="space-y-5">
          {noProjects ? (
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-4">
              <p className="text-sm text-gray-700">Carousels use your brand's colours, fonts and style, so they live in a project. It takes a minute to set one up.</p>
              <div className="mt-3"><LButton onClick={() => setCreating(true)}>Create a project</LButton></div>
            </div>
          ) : (
            <LSelect
              label="Project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={(projects || []).map((p) => ({ value: p.id, label: p.label }))}
            />
          )}
          <Field label="Topic">
            <LTextarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 5 mistakes beginners make with SEO" autoFocus />
          </Field>
        </div>
      )}
      {i === 1 && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Slides</p>
            <div className="flex flex-wrap gap-2">
              {["auto", "3", "4", "5", "6", "7", "8", "9", "10"].map((n) => (
                <Chip key={n} on={slideCount === n} onClick={() => setSlideCount(n)}>{n === "auto" ? "Auto" : n}</Chip>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">Auto lets the AI choose based on the topic.</p>
          </div>
          <LInput label="Call to action (optional)" placeholder="e.g. follow for more, save this, visit link in bio" value={ctaGoal} onChange={(e) => setCtaGoal(e.target.value)} />
          {loading && <p className="text-xs text-gray-500">Making your slides. This can take a few minutes.</p>}
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      <OnboardingModal isOpen={creating} onClose={() => { setCreating(false); setReload((n) => n + 1); }} />
    </WizardShell>
  );
}

// ==================== TikTok Slideshow ====================
export function TikTokQuickModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // No project needed: TikTok slideshows use the reference library.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const handleGenerate = async (params: TikTokSlideshowParams) => {
    setLoading(true);
    setError(null);
    try {
      const out = await generateSlides({
        topic: params.topic,
        platform: "tiktok",
        slideCount: params.slideCount,
        ctaGoal: TIKTOK_CTA_TEXT[params.ctaGoal],
        format: "tiktok_slideshow",
        clientName: params.clientName,
        brandedContent: params.brandedContent,
      });
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <>
      <TikTokSlideshowModal
        isOpen={isOpen && !result}
        onClose={handleClose}
        loading={loading}
        error={error}
        onGenerate={handleGenerate}
      />

      <Modal
        isOpen={isOpen && !!result}
        onClose={handleClose}
        title="TikTok slideshow"
        size="xl"
      >
        {result && <TikTokSlideEditor slides={result.slides} disclosure={result.disclosure} />}
      </Modal>
    </>
  );
}
