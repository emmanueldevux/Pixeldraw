// ============================================================
// UXLLY — New project wizard
//   1. Business (name, what you sell, website, logo)
//   2. Size (cards with the real proportions; one size per project)
//   3. Style (optional references, brand colours, tone, font)
// Same popup look as the sign-up business details. File name kept so the
// Projects page keeps working unchanged.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Plus, Upload } from "lucide-react";
import { AdPackPicker, CarouselSettings, CharacterSheet } from "@/components/ai/ProjectSettings";
import SlideshowStyleWizard from "@/components/ai/SlideshowStyleWizard";
import { EMPTY_PROJECT_CAROUSEL, type ProjectCarouselSettings } from "@/lib/carousels/types";
import type { Character } from "@/lib/slideshow/types";
import WizardShell, { type ShellStep } from "@/components/ui/WizardShell";
import SizeCards from "@/components/ui/SizeCards";
import { Chip, FIELD, LButton, LInput, LTextarea } from "@/components/ui/light";
import { PLATFORM_PRESETS } from "@/lib/platforms";
import { FONT_OPTIONS } from "@/lib/fonts";
import type { TemplateReference } from "@/lib/templates";
import type { PlatformKey } from "@/types";

export type ProjectKind = "ads" | "carousels" | "slideshows" | "thumbnails";

const BUSINESS: ShellStep = { id: "business", title: "Tell us about the business", sub: "This is what the AI writes from, so be specific. You can change it later in project settings." };
const STYLE: ShellStep = { id: "style", title: "Show us your style", sub: "All optional. Add examples you like and set your brand colours." };

const KINDS: Record<ProjectKind, { heading: string; sizeKeys?: string[]; size: ShellStep; extra?: ShellStep; style: boolean; firstPlatform: PlatformKey }> = {
  ads: {
    heading: "New ads project",
    sizeKeys: ["instagram_portrait", "instagram_post", "instagram_story", "facebook_portrait", "facebook", "linkedin_portrait", "linkedin_post", "pinterest", "twitter"],
    size: { id: "size", title: "Default ad size", sub: "Pick the size this project makes by default. You can still ask for another size in chat." },
    extra: { id: "type", title: "Reference ads", sub: "Pick a ready-made pack or add your own ads. The AI copies the layout and swaps in your brand." },
    style: true,
    firstPlatform: "instagram_portrait",
  },
  carousels: {
    heading: "New carousels project",
    sizeKeys: ["instagram_portrait", "instagram_post", "linkedin_portrait", "linkedin_carousel", "facebook_portrait"],
    size: { id: "size", title: "Default carousel size", sub: "Pick the slide size this project makes by default." },
    extra: { id: "type", title: "Carousel style", sub: "Pick a style or create your own. Every carousel in this project follows it." },
    style: true,
    firstPlatform: "instagram_portrait",
  },
  slideshows: {
    heading: "New slideshows project",
    sizeKeys: ["tiktok", "instagram_story", "instagram_portrait", "instagram_post"],
    size: { id: "size", title: "Default slideshow size", sub: "9:16 is full-screen TikTok. Pick the size this project makes by default." },
    extra: { id: "type", title: "Character and slideshow style", sub: "Add a character so the same person appears in every slide, and pick a look. Both optional." },
    style: false,
    firstPlatform: "tiktok",
  },
  thumbnails: {
    heading: "New thumbnails project",
    sizeKeys: ["youtube_thumbnail", "twitter", "facebook", "linkedin_post", "instagram_post", "instagram_portrait"],
    size: { id: "size", title: "Default thumbnail size", sub: "Most thumbnails are landscape. Pick the size this project makes by default." },
    extra: { id: "type", title: "Reference thumbnails", sub: "Pick a ready-made style or add your own thumbnails. The AI studies composition, emotion and colour." },
    style: false,
    firstPlatform: "youtube_thumbnail",
  },
};

const DEFAULT_STEPS: ShellStep[] = [
  BUSINESS,
  { id: "size", title: "What are you designing for?", sub: "Pick the size this project makes. 4:5 portrait is the best-performing feed size on Instagram, Facebook and LinkedIn." },
  STYLE,
];

function SlideshowStylePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [styles, setStyles] = useState<{ id: string; name: string; cover?: string; mine?: boolean }[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = () => fetch("/api/slideshow/styles").then((r) => r.json()).then((d) => setStyles(d.styles || [])).catch(() => setStyles([]));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-800">Slideshow style</p>
      {styles === null ? (
        <Loader2 className="animate-spin text-gray-300" size={18} />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <button type="button" onClick={() => onChange("")} className={`rounded-xl border p-2 text-left ${!value ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
            <div className="aspect-[3/4] rounded-lg bg-gray-100" />
            <p className="text-xs font-medium text-gray-800 mt-1.5">Default</p>
          </button>
          {styles.map((st) => (
            <button key={st.id} type="button" onClick={() => onChange(st.id)} className={`rounded-xl border p-2 text-left ${value === st.id ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="aspect-[3/4] rounded-lg bg-gray-100 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {st.cover && <img src={st.cover} alt="" className="w-full h-full object-cover" />}
              </div>
              <p className="text-xs font-medium text-gray-800 mt-1.5 truncate">{st.name}{st.mine ? " (yours)" : ""}</p>
            </button>
          ))}
          <button type="button" onClick={() => setCreating(true)} className="rounded-xl border border-dashed border-gray-300 p-2 text-gray-500 hover:border-gray-400 flex flex-col items-center justify-center gap-1 aspect-[3/4] self-start"><Plus className="w-5 h-5" /><span className="text-xs">My style</span></button>
        </div>
      )}
      {creating && <SlideshowStyleWizard onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onChange(id); load(); }} />}
    </div>
  );
}

const TONES = ["bold", "professional", "minimal", "casual", "playful"];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

function ColourBox({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-gray-200 px-3 h-12">
      <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded-md border-0 bg-transparent cursor-pointer disabled:opacity-40" />
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-gray-800 leading-tight">{label}</span>
        <span className="block text-[11px] text-gray-400 font-mono leading-tight">{disabled ? "AI decides" : value}</span>
      </span>
    </label>
  );
}

export default function OnboardingModal({ isOpen, onClose, kind, openChat }: { isOpen: boolean; onClose: () => void; kind?: ProjectKind; openChat?: boolean }) {
  if (!isOpen) return null;
  return <Wizard onClose={onClose} kind={kind} openChat={openChat ?? !!kind} />;
}

function Wizard({ onClose, kind, openChat }: { onClose: () => void; kind?: ProjectKind; openChat: boolean }) {
  const router = useRouter();
  const K = kind ? KINDS[kind] : null;
  const STEPS: ShellStep[] = K ? [BUSINESS, K.size, K.extra!, ...(K.style ? [STYLE] : [])] : DEFAULT_STEPS;
  const [adPackId, setAdPackId] = useState("");
  const [thumbPackId, setThumbPackId] = useState("");
  const [carouselS, setCarouselS] = useState<ProjectCarouselSettings>(EMPTY_PROJECT_CAROUSEL);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [slideshowStyleId, setSlideshowStyleId] = useState("");
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState("");

  const [brandName, setBrandName] = useState("");
  const [offering, setOffering] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformKey | null>(K ? K.firstPlatform : "instagram_portrait");

  const [refs, setRefs] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [templates, setTemplates] = useState<TemplateReference[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [primary, setPrimary] = useState("#1A1A1A");
  const [secondary, setSecondary] = useState("#FFFFFF");
  const [accent, setAccent] = useState("#00A8E8");
  const [background, setBackground] = useState("#0A0A0A");
  const [enforceBg, setEnforceBg] = useState(false);
  const [tone, setTone] = useState("bold");
  const [font, setFont] = useState("Inter");

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => d.success && setTemplates(d.templates))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
    // Pre-fill from the sign-up answers.
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d) => {
        const a = d?.answers;
        if (!a) return;
        setBrandName((v) => v || a.businessName || "");
        setOffering((v) => v || a.offering || "");
        setWebsite((v) => v || a.websiteUrl || "");
      })
      .catch(() => {});
  }, []);

  const setRefFiles = (files: File[]) => {
    const next = files.slice(0, 10);
    refPreviews.forEach((u) => URL.revokeObjectURL(u));
    setRefs(next);
    setRefPreviews(next.map((f) => URL.createObjectURL(f)));
  };
  const pickTemplate = async (url: string) => {
    const blob = await (await fetch(url)).blob();
    setRefFiles([...refs, new File([blob], `template-${Date.now()}.png`, { type: blob.type || "image/png" })]);
  };

  const sid = STEPS[i].id;
  const lastStep = i === STEPS.length - 1;
  const canContinue = sid === "business" ? brandName.trim().length > 0 : sid === "size" ? !!platform : true;

  async function create() {
    if (!platform) return;
    setBusy(true);
    try {
      const preset = PLATFORM_PRESETS[platform];
      const referenceBase64 = await Promise.all(refs.map(fileToBase64));
      const logoBase64 = logo ? await fileToBase64(logo) : null;
      const description = [offering.trim(), website.trim() && `Website: ${website.trim()}`].filter(Boolean).join("\n");
      setStatus("Creating your project…");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName.trim(),
          channelName: `${brandName.trim()} · ${preset.name}`,
          platform,
          channelDescription: description,
          referenceImages: referenceBase64,
          logoBase64,
          styleNotes: notes,
          primaryColor: primary,
          secondaryColor: secondary,
          accentColor: accent,
          backgroundColor: enforceBg ? background : null,
          tone,
          headingFont: font,
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const created = (await res.json()).data;
      const brandId = created?.brand?.id;
      const channelId = created?.channel?.id;
      if (brandId && kind) {
        setStatus("Saving your settings…");
        await fetch("/api/projects/style", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId,
            advancedSettings: {
              ...(kind === "ads" ? { adPackId } : {}),
              ...(kind === "thumbnails" ? { thumbPackId } : {}),
              ...(kind === "carousels" ? { carousel: carouselS } : {}),
              ...(kind === "slideshows" ? { characters, slideshowStyleId } : {}),
            },
          }),
        }).catch(() => {});
      }
      if (brandId && referenceBase64.length > 0) {
        setStatus("The AI is studying your references…");
        await fetch("/api/projects/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId, referenceImages: referenceBase64 }) }).catch(() => {});
      }
      if (openChat && channelId) {
        router.push(`/ai?channel=${channelId}`);
        onClose();
        return;
      }
      setDone(true);
    } catch (e) {
      console.error(e);
      setStatus("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const next = () => (lastStep ? create() : setI(i + 1));

  return (
    <WizardShell
      heading={K ? K.heading : "New project"}
      steps={STEPS}
      index={i}
      done={done}
      doneTitle="Project created"
      doneText={`"${brandName}" is ready. Open AI Studio to start making content. Your brand brain is being built in the background.`}
      doneAction={<LButton variant="lime" size="lg" onClick={onClose}>Start creating</LButton>}
      busy={busy}
      continueDisabled={!canContinue}
      finishLabel="Create project"
      skippable={sid === "style" || sid === "type"}
      onBack={() => setI(Math.max(0, i - 1))}
      onNext={next}
      onSkip={() => (lastStep ? create() : setI(i + 1))}
      onClose={onClose}
      wide={sid !== "business"}
    >
      {sid === "business" && (
        <div className="space-y-5">
          <LInput label="Business or brand name" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. Bean & Brew Coffee" autoFocus />
          <LTextarea label="What do you sell or offer?" value={offering} onChange={(e) => setOffering(e.target.value)} rows={3} placeholder="e.g. Specialty coffee, pastries and beans for home brewing, in Lagos" />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-800">Website <span className="font-normal text-gray-400">(optional)</span></span>
            <span className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 h-12 focus-within:border-gray-900">
              <Globe size={18} className="text-gray-400" />
              <input className="flex-1 bg-transparent outline-none text-[15px] text-gray-900 placeholder:text-gray-400" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbusiness.com" inputMode="url" />
            </span>
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-gray-800">Logo <span className="font-normal text-gray-400">(optional)</span></span>
            <label className="flex items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-400 transition-colors overflow-hidden">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo" className="h-full object-contain p-2" />
              ) : (
                <span className="flex flex-col items-center text-gray-400"><Upload size={20} /><span className="text-xs mt-1">Click to upload</span></span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogo(f); setLogoPreview(URL.createObjectURL(f)); } }} />
            </label>
            <p className="mt-1 text-xs text-gray-500">Placed exactly as-is on every design. Never redrawn.</p>
          </div>
        </div>
      )}

      {sid === "size" && <SizeCards value={platform} onChange={setPlatform} keys={K?.sizeKeys} />}

      {sid === "type" && kind === "ads" && <AdPackPicker value={adPackId} onChange={setAdPackId} />}
      {sid === "type" && kind === "thumbnails" && <AdPackPicker purpose="thumbnail" value={thumbPackId} onChange={setThumbPackId} />}
      {sid === "type" && kind === "carousels" && <CarouselSettings value={carouselS} onChange={setCarouselS} />}
      {sid === "type" && kind === "slideshows" && (
        <div className="space-y-6">
          <CharacterSheet characters={characters} onChange={setCharacters} />
          <SlideshowStylePick value={slideshowStyleId} onChange={setSlideshowStyleId} />
        </div>
      )}

      {sid === "style" && (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Pick a style you like</p>
            {templatesLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-gray-400">No templates available yet.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {templates.map((t) => (
                  <button key={t.id} type="button" onClick={() => pickTemplate(t.publicUrl)} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-gray-900 transition-colors bg-gray-50" title={t.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.publicUrl} alt={t.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Reference images <span className="font-normal text-gray-400">({refs.length}/10)</span></p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {refPreviews.map((p, n) => (
                <div key={p} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setRefFiles(refs.filter((_, k) => k !== n))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
              {refs.length < 10 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 text-gray-400">
                  <Upload size={18} />
                  <span className="text-[10px] mt-1">Add</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setRefFiles([...refs, ...Array.from(e.target.files || [])])} />
                </label>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">Posts you like or competitor graphics. No references? No problem, the AI will use brand colours and the project's ad pack.</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Brand colours</p>
            <div className="grid grid-cols-2 gap-2.5">
              <ColourBox label="Primary" value={primary} onChange={setPrimary} />
              <ColourBox label="Accent" value={accent} onChange={setAccent} />
              <ColourBox label="Text" value={secondary} onChange={setSecondary} />
              <div>
                <ColourBox label="Background" value={background} onChange={setBackground} disabled={!enforceBg} />
                <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer"><input type="checkbox" checked={enforceBg} onChange={(e) => setEnforceBg(e.target.checked)} /> Always use this background</label>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Tone</p>
            <div className="flex flex-wrap gap-2">{TONES.map((t) => <Chip key={t} on={tone === t} onClick={() => setTone(t)}><span className="capitalize">{t}</span></Chip>)}</div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Heading font</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONT_OPTIONS.map((f) => (
                <button key={f.name} type="button" onClick={() => setFont(f.name)} className={`px-3 py-2 rounded-xl border text-left transition-colors ${font === f.name ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-400"}`}>
                  <p className="text-sm font-semibold text-gray-900 truncate" style={{ fontFamily: `"${f.name}", sans-serif` }}>{f.sample}</p>
                  <p className="text-[10px] text-gray-400 truncate">{f.name}</p>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-800">Style notes <span className="font-normal text-gray-400">(optional)</span></span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${FIELD} py-3 resize-none`} placeholder="e.g. Dark backgrounds, bold type, minimal layout" />
          </label>
        </div>
      )}

      {busy && <p className="mt-5 text-sm text-gray-500 animate-pulse">{status}</p>}
      {!busy && status && !done && <p className="mt-5 text-sm text-red-600">{status}</p>}
    </WizardShell>
  );
}
