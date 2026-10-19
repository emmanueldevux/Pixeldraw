// ============================================================
// UXLLY — TikTok Slideshow Modal
// Separate from the carousel modal: TikTok slideshows follow the
// playbook (hook → value slides → close), use 9:16 slides, and
// require the commercial-content disclosure when a client is paid.
// ============================================================

"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export type TikTokCtaGoal = "save" | "follow" | "try_tool" | "none";

export interface TikTokSlideshowParams {
  topic: string;
  slideCount?: number;
  ctaGoal: TikTokCtaGoal;
  clientName?: string;
  brandedContent: boolean;
}

interface TikTokSlideshowModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandName?: string;
  loading?: boolean;
  onGenerate: (params: TikTokSlideshowParams) => void;
}

const CTA_OPTIONS: { value: TikTokCtaGoal; label: string; hint: string }[] = [
  { value: "save", label: "Save", hint: "Ask the reader to save the post for later." },
  { value: "follow", label: "Follow", hint: "Ask the reader to follow for the next tip." },
  { value: "try_tool", label: "Try the tool", hint: "Use the product slide and point to the link in bio." },
  { value: "none", label: "No CTA", hint: "Value only, no ask." },
];

export default function TikTokSlideshowModal({
  isOpen,
  onClose,
  brandName,
  loading = false,
  onGenerate,
}: TikTokSlideshowModalProps) {
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState<string>("auto");
  const [ctaGoal, setCtaGoal] = useState<TikTokCtaGoal>("save");
  const [clientName, setClientName] = useState("");
  const [brandedContent, setBrandedContent] = useState(true);

  // A paid or free-product post needs the client named for the
  // branded-content tag, so block submit until it is filled in.
  const needsClient = brandedContent && !clientName.trim();
  const canSubmit = topic.trim().length > 0 && !needsClient && !loading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onGenerate({
      topic: topic.trim(),
      slideCount: slideCount === "auto" ? undefined : parseInt(slideCount, 10),
      ctaGoal,
      clientName: brandedContent ? clientName.trim() : undefined,
      brandedContent,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create TikTok Slideshow">
      <div className="space-y-4">
        <Input
          label="Topic or hook angle"
          placeholder="e.g. 5 review traps that quietly hurt your Amazon listing"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          hint="The first slide promises a payoff from this. Name the reader's situation."
        />

        <div>
          <label className="text-xs text-ink-600 mb-1 block">Slide count</label>
          <select
            value={slideCount}
            onChange={(e) => setSlideCount(e.target.value)}
            className="uxlly-input text-xs"
          >
            <option value="auto">Auto — 5–7 slides, the playbook default</option>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n} slides</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-ink-600 mb-1 block">Closing ask</label>
          <select
            value={ctaGoal}
            onChange={(e) => setCtaGoal(e.target.value as TikTokCtaGoal)}
            className="uxlly-input text-xs"
          >
            {CTA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-ink-400 mt-1">
            {CTA_OPTIONS.find((o) => o.value === ctaGoal)?.hint}
          </p>
        </div>

        <div className="rounded-lg border border-surface-200 p-3 space-y-3">
          <label className="flex items-start gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={brandedContent}
              onChange={(e) => setBrandedContent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              This post promotes a client&apos;s business (paid, free product, or affiliate link)
              <span className="block text-xs text-ink-400 mt-0.5">
                Turns on TikTok&apos;s branded-content disclosure with the client tagged as the brand partner. Leave on for any client-run account.
              </span>
            </span>
          </label>

          {brandedContent && (
            <Input
              label="Client name"
              placeholder="e.g. CrawlGecko"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              hint={needsClient ? "Required for the branded-content tag." : "Used for the disclosure tag."}
              error={needsClient && topic.trim() ? "Enter the client name to continue." : undefined}
            />
          )}
        </div>

        <p className="text-xs text-ink-400">
          Brand: {brandName || "none selected"}. Slides are 9:16 and the layout, background and character stay locked across the set. Only the copy and subject change per slide.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!canSubmit} onClick={handleSubmit}>
            Generate Slideshow
          </Button>
        </div>
      </div>
    </Modal>
  );
}
