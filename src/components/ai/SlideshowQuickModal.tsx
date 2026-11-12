// ============================================================
// UXLLY — "Make a slideshow" popup (header + dashboard)
// Pick a project (skipped when there's only one) → the slideshow wizard →
// the finished slides open in the TikTok-style editor. Same flow the AI
// studio uses, just without leaving the page you're on.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import LModal from "@/components/ui/LModal";
import { LButton, LSelect } from "@/components/ui/light";
import SlideshowWizard, { type SlideshowResult } from "@/components/ai/SlideshowWizard";
import TikTokSlideEditor from "@/components/ai/TikTokSlideEditor";
import { useBilling } from "@/components/billing/BillingProvider";

interface Project { brandId: string; label: string }

export default function SlideshowQuickModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { openTopUp, refresh } = useBilling();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [brandId, setBrandId] = useState("");
  const [chosen, setChosen] = useState(false);
  const [result, setResult] = useState<SlideshowResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const list: Project[] = (d.data || []).map((b: { id: string; name: string }) => ({ brandId: b.id, label: b.name }));
        setProjects(list);
        setBrandId((cur) => cur || list[0]?.brandId || "");
        if (list.length <= 1) setChosen(true); // 0 projects = a quick slideshow, 1 = that one
      })
      .catch(() => setProjects([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => {
    setResult(null);
    setChosen(false);
    onClose();
  };

  if (projects === null) return null;

  if (result) {
    return (
      <LModal wide title={result.title || "Your slideshow"} sub={`${result.slides.length} slides. Tap a slide to edit the text. It's saved to your Files.`} onClose={close} footer={<LButton onClick={close}>Done</LButton>}>
        <TikTokSlideEditor slides={result.slides} disclosure={null} />
      </LModal>
    );
  }

  if (!chosen) {
    return (
      <LModal title="Make a slideshow" sub="Which project is it for? A project brings your characters and brand voice." onClose={close} footer={<LButton onClick={() => setChosen(true)}>Continue</LButton>}>
        <LSelect label="Project" value={brandId} onChange={(e) => setBrandId(e.target.value)} options={[...projects.map((p) => ({ value: p.brandId, label: p.label })), { value: "", label: "No project (quick slideshow)" }]} />
      </LModal>
    );
  }

  return (
    <SlideshowWizard
      brandId={brandId}
      onClose={close}
      onInsufficient={(neededMilli) => openTopUp({ reason: "out_of_credits", neededMilli })}
      onDone={(r) => {
        refresh?.();
        setResult(r);
      }}
    />
  );
}
