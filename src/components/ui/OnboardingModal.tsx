// ============================================================
// UXLLY — Onboarding Modal
// Multi-step: Brand → Channel → Style Guide → Done
// ============================================================

"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { PLATFORM_PRESETS } from "@/lib/platforms";
import { FONT_OPTIONS } from "@/lib/fonts";
import TemplatePickerModal from "@/components/ui/TemplatePickerModal";
import type { PlatformKey } from "@/types";
import {
  Building2,
  Palette,
  Globe,
  Check,
  ArrowRight,
  ArrowLeft,
  Upload,
} from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "brand" | "channel" | "style" | "analyzing" | "done";

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: "brand", label: "Brand", icon: <Building2 size={16} /> },
  { key: "channel", label: "Channel", icon: <Globe size={16} /> },
  { key: "style", label: "References", icon: <Palette size={16} /> },
  { key: "done", label: "Done", icon: <Check size={16} /> },
];

export default function OnboardingModal({
  isOpen,
  onClose,
}: OnboardingModalProps) {
  const [step, setStep] = useState<Step>("brand");
  const [loading, setLoading] = useState(false);

  // ==================== Form State ====================
  const [brandName, setBrandName] = useState("");
  const [brandLogo, setBrandLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");
  const [platform, setPlatform] = useState<PlatformKey>("instagram_post");
  const [channelDescription, setChannelDescription] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
  const [styleNotes, setStyleNotes] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1A1A1A");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [accentColor, setAccentColor] = useState("#00A8E8");
  const [backgroundColor, setBackgroundColor] = useState("#0A0A0A");
  const [enforceBackground, setEnforceBackground] = useState(false);
  const [tone, setTone] = useState("bold");
  const [headingFont, setHeadingFont] = useState("Inter");

  const platformOptions = Object.values(PLATFORM_PRESETS).map((p) => ({
    value: p.key,
    label: `${p.name} (${p.width}×${p.height})`,
  }));

  // ==================== Step Navigation ====================
  const currentIndex = STEPS.findIndex((s) => s.key === step);

  const goNext = () => {
    const next = STEPS[currentIndex + 1];
    if (next) setStep(next.key);
  };

  const goBack = () => {
    const prev = STEPS[currentIndex - 1];
    if (prev) setStep(prev.key);
  };

  // ==================== Add Reference Images ====================
  const handleAddReferences = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...referenceImages, ...files].slice(0, 10); // max 10
    setReferenceImages(newFiles);

    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    referencePreviews.forEach((url) => URL.revokeObjectURL(url));
    setReferencePreviews(newPreviews);
  };

  // Picking a template from the grid modal returns a base64 data URL —
  // converted back into a real File object here so it flows through the
  // exact same state, preview thumbnails, and remove logic as an upload,
  // with no special-casing needed anywhere else in this component.
  const handleTemplateSelected = async (base64DataUrl: string) => {
    const res = await fetch(base64DataUrl);
    const blob = await res.blob();
    const file = new File([blob], `template-${Date.now()}.png`, { type: blob.type || "image/png" });

    const newFiles = [...referenceImages, file].slice(0, 10);
    setReferenceImages(newFiles);

    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    referencePreviews.forEach((url) => URL.revokeObjectURL(url));
    setReferencePreviews(newPreviews);
  };

  const removeReference = (index: number) => {
    URL.revokeObjectURL(referencePreviews[index]);
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    setReferencePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ==================== Convert file to base64 ====================
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ==================== Submit ====================
  const [analysisStatus, setAnalysisStatus] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Convert reference images to base64
      const referenceBase64 = await Promise.all(
        referenceImages.map((f) => fileToBase64(f))
      );

      // Convert logo to base64 if one was uploaded — sent separately
      // from style references. The logo is never analyzed or edited,
      // just stored and placed exactly as-is on generated images.
      const logoBase64 = brandLogo ? await fileToBase64(brandLogo) : null;

      // Step 1: Create the project
      setAnalysisStatus("Creating project...");
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          channelName,
          platform,
          channelDescription,
          referenceImages: referenceBase64,
          logoBase64,
          styleNotes,
          primaryColor,
          secondaryColor,
          accentColor,
          backgroundColor: enforceBackground ? backgroundColor : null,
          tone,
          headingFont,
        }),
      });

      if (!response.ok) throw new Error("Failed to create project");

      const projectData = await response.json();
      const brandId = projectData.data?.brand?.id;

      // Step 2: Analyze references with GPT-4o Vision
      if (brandId && referenceBase64.length > 0) {
        setStep("analyzing");
        setAnalysisStatus("AI is studying your references...");

        try {
          const analysisRes = await fetch("/api/projects/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brandId,
              referenceImages: referenceBase64,
            }),
          });

          if (analysisRes.ok) {
            const analysisData = await analysisRes.json();
            setAnalysisStatus(
              `Found ${Object.keys(analysisData.data?.extractedColors || {}).length} colors · ${analysisData.data?.detectedTone} tone · ${analysisData.data?.detectedFont} font`
            );
          } else {
            setAnalysisStatus("Analysis complete (partial). You can refine in Settings.");
          }
        } catch {
          setAnalysisStatus("Style saved. Analysis can be re-run from Settings.");
        }
      }

      // Step 3: Done
      setTimeout(() => setStep("done"), 1500);
    } catch (err) {
      console.error("Failed to create project:", err);
      setAnalysisStatus("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a Project"
      size="lg"
    >
      {/* ==================== Step Indicators ==================== */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                i <= currentIndex
                  ? "bg-brand-500 text-white"
                  : "bg-surface-100 text-ink-400"
              }`}
            >
              {i < currentIndex ? <Check size={14} /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium hidden sm:block ${
                i <= currentIndex ? "text-ink-900" : "text-ink-400"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  i < currentIndex ? "bg-brand-500" : "bg-surface-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ==================== Step: Brand ==================== */}
      {step === "brand" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900 mb-1">
              Tell us about your brand
            </h3>
            <p className="text-sm text-ink-400">
              This creates a brand workspace. You can add multiple channels
              later.
            </p>
          </div>
          <Input
            label="Brand Name"
            placeholder="e.g. Acme Corp"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            required
          />
          <div>
            <label className="text-sm font-medium text-ink-800 mb-1.5 block">
              Brand Logo (optional)
            </label>
            <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-surface-200 rounded-xl cursor-pointer hover:border-brand-300 hover:bg-brand-50/20 transition-colors overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="h-full object-contain p-2" />
              ) : (
                <div className="flex flex-col items-center">
                  <Upload size={20} className="text-ink-400 mb-1" />
                  <span className="text-xs text-ink-400">
                    Click to upload logo
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setBrandLogo(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
            {brandLogo && (
              <p className="text-xs text-ink-400 mt-1">{brandLogo.name}</p>
            )}
            <p className="text-xs text-ink-400 mt-1">
              Placed exactly as-is on every generation — never redrawn or restyled.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={goNext}
              disabled={!brandName.trim()}
              icon={<ArrowRight size={14} />}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ==================== Step: Channel ==================== */}
      {step === "channel" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900 mb-1">
              Set up your content channel
            </h3>
            <p className="text-sm text-ink-400">
              A channel is a specific platform account you&apos;ll post to.
            </p>
          </div>
          <Input
            label="Channel Name"
            placeholder="e.g. Main Instagram, TikTok Growth"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            required
          />
          <Select
            label="Platform"
            options={platformOptions}
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformKey)}
          />
          <Input
            label="Description (optional)"
            placeholder="What kind of content does this channel focus on?"
            value={channelDescription}
            onChange={(e) => setChannelDescription(e.target.value)}
          />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={goBack} icon={<ArrowLeft size={14} />}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={goNext}
              disabled={!channelName.trim()}
              icon={<ArrowRight size={14} />}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ==================== Step: Reference Board ==================== */}
      {step === "style" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900 mb-1">
              Show us your style
            </h3>
            <p className="text-sm text-ink-400">
              Upload examples of graphics you love. The AI will analyze the
              colors, fonts, layout, and vibe to match your style when
              generating new content.
            </p>
          </div>

          {/* Pick a Style — always-visible template shortcut */}
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Pick a style</p>
            <button
              type="button"
              onClick={() => setShowTemplatePicker(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 py-3 rounded-lg border-2 border-dashed border-brand-200 hover:bg-brand-50/30 transition-colors"
            >
              <Palette size={16} />
              Browse templates
            </button>
          </div>

          {/* Reference Image Upload */}
          <div>
            <label className="text-sm font-medium text-ink-800 mb-1.5 block">
              Reference Images ({referenceImages.length}/10)
            </label>

            {/* Image Grid */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {referencePreviews.map((preview, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-lg overflow-hidden border border-surface-200 group"
                >
                  <img
                    src={preview}
                    alt={`Reference ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeReference(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Add more button */}
              {referenceImages.length < 10 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-surface-200 flex flex-col items-center justify-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/20 transition-colors">
                  <Upload size={20} className="text-ink-400 mb-1" />
                  <span className="text-[10px] text-ink-400 text-center px-1">
                    Add images
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAddReferences}
                  />
                </label>
              )}
            </div>

            <p className="text-xs text-ink-400">
              Screenshots of posts you like, brand mood boards, competitor
              graphics — anything that shows the style you want.
            </p>
          </div>

          {/* Style Notes */}
          <div>
            <label className="text-sm font-medium text-ink-800 mb-1.5 block">
              Style Notes (optional)
            </label>
            <textarea
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              placeholder="e.g. Dark backgrounds, bold sans-serif type, neon accents, minimal layout, tech/modern feel..."
              className="uxlly-input min-h-[80px] resize-y"
              rows={3}
            />
          </div>

          {/* Brand Colors & Tone */}
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Brand Colors & Tone</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-ink-600 mb-1 block">Primary</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded border border-surface-200 cursor-pointer" />
                  <span className="text-xs text-ink-500 font-mono">{primaryColor}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-600 mb-1 block">Secondary</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-8 h-8 rounded border border-surface-200 cursor-pointer" />
                  <span className="text-xs text-ink-500 font-mono">{secondaryColor}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-600 mb-1 block">Accent</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-8 rounded border border-surface-200 cursor-pointer" />
                  <span className="text-xs text-ink-500 font-mono">{accentColor}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-600 mb-1 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={enforceBackground}
                    onChange={(e) => setEnforceBackground(e.target.checked)}
                    className="cursor-pointer"
                  />
                  Background
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    disabled={!enforceBackground}
                    className="w-8 h-8 rounded border border-surface-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs text-ink-500 font-mono">
                    {enforceBackground ? backgroundColor : "AI decides"}
                  </span>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-ink-600 mb-1 block">Tone</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)} className="uxlly-input text-xs">
                  <option value="bold">Bold</option>
                  <option value="professional">Professional</option>
                  <option value="minimal">Minimal</option>
                  <option value="casual">Casual</option>
                  <option value="playful">Playful</option>
                </select>
              </div>
            </div>
          </div>

          {/* Font */}
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Heading Font</p>
            <div className="grid grid-cols-3 gap-2">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setHeadingFont(f.name)}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                    headingFont === f.name
                      ? "border-brand-500 bg-brand-50"
                      : "border-surface-200 hover:border-surface-300"
                  }`}
                >
                  <p
                    className="text-sm font-semibold text-ink-900 truncate"
                    style={{ fontFamily: `"${f.name}", sans-serif` }}
                  >
                    {f.sample}
                  </p>
                  <p className="text-[10px] text-ink-400 truncate">{f.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={goBack} icon={<ArrowLeft size={14} />}>
              Back
            </Button>
            <Button
              variant="primary"
              loading={loading}
              onClick={handleSubmit}
              disabled={referenceImages.length === 0}
            >
              Create Project
            </Button>
          </div>
        </div>
      )}

      {/* ==================== Step: Analyzing ==================== */}
      {step === "analyzing" && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <div className="uxlly-spinner w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">
            Analyzing your references
          </h3>
          <p className="text-sm text-ink-400 mb-4 max-w-xs mx-auto">
            GPT-4o Vision is studying your images to extract colors, typography,
            layout patterns, and visual style...
          </p>
          <p className="text-xs text-brand-500 font-medium animate-pulse">
            {analysisStatus}
          </p>
        </div>
      )}

      {/* ==================== Step: Done ==================== */}
      {step === "done" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 mb-1">
            Project created!
          </h3>
          <p className="text-sm text-ink-400 mb-6">
            Your channel &quot;{channelName}&quot; is ready. Head to AI Studio
            to start generating content.
          </p>
          <Button variant="primary" onClick={onClose}>
            Start creating
          </Button>
        </div>
      )}
    </Modal>

    <TemplatePickerModal
      isOpen={showTemplatePicker}
      onClose={() => setShowTemplatePicker(false)}
      onSelect={handleTemplateSelected}
    />
    </>
  );
}