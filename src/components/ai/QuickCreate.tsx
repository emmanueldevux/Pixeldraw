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

// ==================== Carousel ====================
export function CarouselQuickModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState("auto");
  const [ctaGoal, setCtaGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<CarouselSlideMessage[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadProjects().then((opts) => {
      setProjects(opts);
      setProjectId((cur) => cur || opts[0]?.id || "");
    });
  }, [isOpen]);

  const project = projects.find((p) => p.id === projectId);

  const handleGenerate = async () => {
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

  const handleClose = () => {
    setSlides(null);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Carousel" size="lg">
      {slides ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {slides.map((s) => (
              <div key={s.slideNumber} className="space-y-1">
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt={`Slide ${s.slideNumber}`} className="rounded-lg w-full" />
                ) : (
                  <div className="aspect-[2/3] flex items-center justify-center rounded-lg bg-surface-100 text-xs text-red-400">
                    failed
                  </div>
                )}
                {s.imageUrl && (
                  <a
                    href={s.imageUrl}
                    download={`carousel-slide-${s.slideNumber}.png`}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Download slide {s.slideNumber}
                  </a>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setSlides(null)}>
              Create another
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-600 mb-1 block">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="uxlly-input text-xs"
            >
              {projects.length === 0 && <option value="">No projects yet — create one first</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="Topic"
            placeholder="e.g. 5 mistakes beginners make with SEO"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            hint="The hook, content flow, and CTA are planned from this."
          />

          <div>
            <label className="text-xs text-ink-600 mb-1 block">Slide count</label>
            <select
              value={slideCount}
              onChange={(e) => setSlideCount(e.target.value)}
              className="uxlly-input text-xs"
            >
              <option value="auto">Auto — AI decides based on the topic</option>
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n} slides</option>
              ))}
            </select>
          </div>

          <Input
            label="CTA goal (optional)"
            placeholder="e.g. follow for more, save this, visit link in bio"
            value={ctaGoal}
            onChange={(e) => setCtaGoal(e.target.value)}
          />

          {loading && (
            <p className="text-xs text-ink-400">Generating slides. This can take a few minutes.</p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={loading}
              disabled={!project || !topic.trim() || loading}
              onClick={handleGenerate}
            >
              Generate Carousel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ==================== TikTok Slideshow ====================
export function TikTokQuickModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadProjects().then((opts) => {
      setProjects(opts);
      setProjectId((cur) => cur || opts[0]?.id || "");
    });
  }, [isOpen]);

  const project = projects.find((p) => p.id === projectId);

  const handleGenerate = async (params: TikTokSlideshowParams) => {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      const out = await generateSlides({
        brandId: project.brandId,
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
        brandName={project?.label}
        loading={loading}
        error={error}
        onGenerate={handleGenerate}
        projects={projects.map((p) => ({ id: p.id, label: p.label }))}
        projectId={projectId}
        onProjectChange={setProjectId}
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
