// ============================================================
// UXLLY — Project Settings panel (AI Studio right rail)
// Soft-neutral "raised / inset" UI. Loads from and saves to the
// project via /api/projects/style (+ /logo).
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Palette, Type, Image as ImageIcon, Languages, ShoppingBag, Plus, X, Check, Loader2, ChevronDown, Layers, Ban, UserRound } from "lucide-react";
import OffersBox from "./OffersBox";
import CarouselStyleWizard from "./CarouselStyleWizard";
import AdPackWizard from "./AdPackWizard";
import CharacterWizard from "./CharacterWizard";
import { cleanCharacters, type Character } from "@/lib/slideshow/types";
import { EMPTY_PROJECT_CAROUSEL, readProjectCarousel, type ProjectCarouselSettings } from "@/lib/carousels/types";

const HEADING_FONTS = ["Helvetica Now Display", "Inter", "Inter Tight", "Montserrat", "Poppins", "Oswald", "Anton", "Playfair Display"];
const BODY_FONTS = ["Helvetica Now Display", "Inter", "Inter Tight", "Roboto", "Lato", "Open Sans", "Poppins"];
const FONT_CSS: Record<string, string> = {
  "Helvetica Now Display": "var(--font-helvetica)",
  "Inter": "var(--font-inter)",
  "Inter Tight": "var(--font-inter-tight)",
};
const fontStyle = (v: string) => ({ fontFamily: FONT_CSS[v] ?? `"${v}", sans-serif` });
const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Arabic", "Hindi", "Chinese", "Japanese", "Korean"];

// 3x3 grid of logo placements (null = not supported)
const LOGO_GRID: (string | null)[] = [
  "top-left", "top-middle", "top-right",
  null, "center", null,
  "bottom-left", "bottom-middle", "bottom-right",
];

export interface EcommerceSettings {
  enabled: boolean;
  productName: string;
  productDescription: string;
  price: string;
  salePrice: string;
  promoCode: string;
  productImage: string | null;
  shopCta: string;
  productUrl: string;
}

interface State {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string | null;
  headingFont: string;
  bodyFont: string;
  tone: string;
  referenceImages: string[];
  logo: string | null;
  logoPosition: string;
  logoScale: number | null;
  language: string;
  ecommerce: EcommerceSettings;
  carousel: ProjectCarouselSettings;
  adPackId: string;
  negativePrompt: string;
  characters: Character[];
}

const EMPTY_ECOM: EcommerceSettings = {
  enabled: false, productName: "", productDescription: "", price: "", salePrice: "",
  promoCode: "", productImage: null, shopCta: "Shop now", productUrl: "",
};

function fileToScaledDataUrl(file: File, max = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("load failed"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ==================== Style tokens ====================
const RAISED =
  "bg-gradient-to-b from-white to-[#EDEDEF] border border-[#DCDCE0] shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] hover:to-[#E6E6E9] active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)] active:bg-[#E9E9EC]";
const INSET = "bg-[#EDEDEF] border border-[#E1E1E4] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]";
const FIELD =
  "w-full h-11 px-3 rounded-xl bg-white border border-[#D4D4D8] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] text-[13px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:bg-[#F1F1F3] disabled:text-zinc-400";
const LABEL = "text-[11px] font-medium text-zinc-500 mb-1.5 block";

// ==================== Primitives ====================
function Section({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className="px-5 py-4 border-b border-[#E7E7EA] last:border-b-0">
      <div className={`flex items-center justify-between gap-3 ${children ? "mb-3.5" : ""}`}>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
          <span className="text-zinc-400">{icon}</span>
          {title}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-[46px] h-[26px] rounded-full transition-colors shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] ${on ? "bg-[#52525B]" : "bg-[#D4D4D8]"}`}
    >
      <span
        className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-all ${on ? "left-[23px]" : "left-[3px]"}`}
      />
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className={`flex p-1 gap-1 rounded-xl ${INSET}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${
            value === o.value
              ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.03)]"
              : "text-zinc-400 hover:text-zinc-600"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Select({
  value, options, onChange, placeholder, fontPreview, muted,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  fontPreview?: boolean;
  muted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (ev: MouseEvent) => { if (!ref.current?.contains(ev.target as Node)) setOpen(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-11 pl-3 pr-2.5 rounded-xl flex items-center justify-between gap-2 text-[13px] font-medium text-zinc-900 ${muted ? "bg-[#EFEFF1]" : "bg-white"} border border-[#C4C4CA] hover:border-[#A1A1AA] transition-colors`}
      >
        <span className="truncate" style={fontPreview && current ? fontStyle(current.value) : undefined}>
          {current?.label ?? placeholder ?? "Select"}
        </span>
        <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto p-1 rounded-xl bg-white border border-[#E3E3E6] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.06)]"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full h-9 px-2.5 rounded-lg flex items-center justify-between gap-2 text-[13px] text-left transition-colors ${
                    active ? "bg-[#F1F1F3] font-semibold text-zinc-900" : "text-zinc-700 hover:bg-[#F6F6F7]"
                  }`}
                  style={fontPreview ? fontStyle(o.value) : undefined}
                >
                  <span className="truncate">{o.label}</span>
                  {active && <Check size={14} className="text-zinc-700 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="flex items-center gap-2">
        <div
          className={`relative w-11 h-11 rounded-xl shrink-0 overflow-hidden border border-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.1)] ${disabled ? "opacity-40" : ""}`}
          style={{ background: valid ? value : "#fff" }}
        >
          <input
            type="color"
            value={valid ? value : "#ffffff"}
            disabled={disabled}
            onChange={(ev) => onChange(ev.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label={`${label} color`}
          />
        </div>
        <input type="text" value={value} disabled={disabled} onChange={(ev) => onChange(ev.target.value)} className={`${FIELD} font-mono uppercase min-w-0`} />
      </div>
    </div>
  );
}

function UploadTile({ src, onClick, size = 64, children }: { src: string | null; onClick: () => void; size?: number; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: size, height: size }}
      className={`rounded-xl flex items-center justify-center overflow-hidden shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors ${src ? "bg-white border border-[#E3E3E6]" : "border-2 border-dashed border-[#D4D4D8] bg-[#F4F4F5] hover:bg-[#EDEDEF]"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="w-full h-full object-contain" /> : children ?? <Plus size={16} />}
    </button>
  );
}

// ==================== Panel ====================
export default function ProjectSettings({ brandId }: { brandId: string | null }) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLogo, setNewLogo] = useState<string | null>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const productInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/style?brandId=${encodeURIComponent(brandId)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load settings");
      const adv = data.data.advancedSettings || {};
      setState({
        primaryColor: data.data.primaryColor,
        secondaryColor: data.data.secondaryColor,
        accentColor: data.data.accentColor,
        backgroundColor: data.data.backgroundColor,
        headingFont: data.data.headingFont || "Helvetica Now Display",
        bodyFont: adv.bodyFont || "Helvetica Now Display",
        tone: data.data.tone || "professional",
        referenceImages: data.data.referenceImages || [],
        logo: data.data.logo,
        logoPosition: data.data.logoPosition || "auto",
        logoScale: data.data.logoScale,
        language: adv.language || "",
        ecommerce: { ...EMPTY_ECOM, ...(adv.ecommerce || {}) },
        carousel: readProjectCarousel(adv) || EMPTY_PROJECT_CAROUSEL,
        adPackId: typeof adv.adPackId === "string" ? adv.adPackId : "",
        negativePrompt: typeof adv.negativePrompt === "string" ? adv.negativePrompt : "",
        characters: cleanCharacters(adv.characters),
      });
      setNewLogo(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  const patch = (p: Partial<State>) => setState((s) => (s ? { ...s, ...p } : s));
  const patchEcom = (p: Partial<EcommerceSettings>) =>
    setState((s) => (s ? { ...s, ecommerce: { ...s.ecommerce, ...p } } : s));

  const addReferences = async (files: FileList | null) => {
    if (!files || !state) return;
    try {
      const added: string[] = [];
      for (const f of Array.from(files).slice(0, 8)) {
        if (f.type.startsWith("image/")) added.push(await fileToScaledDataUrl(f));
      }
      patch({ referenceImages: [...state.referenceImages, ...added].slice(0, 24) });
    } catch {
      setError("Couldn't read one of those images.");
    }
  };

  const onLogoFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const b64 = await fileToScaledDataUrl(files[0], 512);
      setNewLogo(b64);
      patch({ logo: b64 });
    } catch {
      setError("Couldn't read that logo.");
    }
  };

  const onProductFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      patchEcom({ productImage: await fileToScaledDataUrl(files[0], 768) });
    } catch {
      setError("Couldn't read that product image.");
    }
  };

  const save = async () => {
    if (!state || !brandId) return;
    setSaving(true);
    setError(null);
    try {
      const stylePut = fetch("/api/projects/style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          primaryColor: state.primaryColor,
          secondaryColor: state.secondaryColor,
          accentColor: state.accentColor,
          backgroundColor: state.backgroundColor,
          headingFont: state.headingFont,
          tone: state.tone,
          referenceImages: state.referenceImages,
          advancedSettings: { bodyFont: state.bodyFont, language: state.language, ecommerce: state.ecommerce, carousel: state.carousel, adPackId: state.adPackId, negativePrompt: state.negativePrompt, characters: state.characters },
        }),
      });
      const logoPut = fetch("/api/projects/logo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          ...(newLogo ? { logoBase64: newLogo } : {}),
          logoPosition: state.logoPosition === "auto" ? "auto" : state.logoPosition,
          logoScale: state.logoScale,
        }),
      });
      const [styleRes] = await Promise.all([stylePut, logoPut]);
      const styleData = await styleRes.json();
      if (!styleData.success) throw new Error(styleData.error || "Save failed");
      setSavedAt(Date.now());
      setNewLogo(null);
      if (styleData.advancedSaved === false) {
        setError("Saved — but language & ecommerce need the database migration (see notes).");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!brandId) {
    return <div className="p-6 text-center text-sm text-zinc-400">Select a project to edit its settings.</div>;
  }
  if (loading || !state) {
    return (
      <div className="p-6 flex items-center justify-center text-zinc-400">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  const e = state.ecommerce;
  const toOpts = (a: string[]) => a.map((v) => ({ value: v, label: v }));
  const logoAuto = state.logoPosition === "auto";

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto">
        {/* ===== Offers (the one part of the brand brain users edit) ===== */}
        <OffersBox brandId={brandId} />

        {/* ===== References ===== */}
        <Section
          icon={<ImageIcon size={15} />}
          title="Style references"
          right={
          <button
  type="button"
  onClick={() => refInput.current?.click()}
  style={{ border: "1px solid #000" }}
  className={`h-8 px-3 rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-1.5 ${RAISED}`}
>
  <Plus size={13} /> Add
</button>
          }
        >
          <input ref={refInput} type="file" accept="image/*" multiple className="hidden" onChange={(ev) => addReferences(ev.target.files)} />
          <div className="grid grid-cols-4 gap-2">
            {state.referenceImages.map((src, i) => (
              <div key={i} className="group relative aspect-square rounded-xl overflow-hidden border border-[#E3E3E6] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="reference" className="w-full h-full object-cover" />
                <button
                  onClick={() => patch({ referenceImages: state.referenceImages.filter((_, j) => j !== i) })}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 text-zinc-700 shadow-[0_1px_3px_rgba(0,0,0,0.25)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove reference"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => refInput.current?.click()}
              aria-label="Add reference images"
              className="aspect-square rounded-xl border-2 border-dashed border-[#D4D4D8] bg-[#F4F4F5] hover:bg-[#EDEDEF] hover:border-[#C4C4CA] text-zinc-400 hover:text-zinc-600 flex items-center justify-center transition-colors"
            >
              <Plus size={20} strokeWidth={1.8} />
            </button>
          </div>
        </Section>

        {/* ===== Colors ===== */}
        <Section icon={<Palette size={15} />} title="Colors">
          <div className="mb-3.5">
            <Segmented
              value={state.backgroundColor === null ? "ai" : "custom"}
              onChange={(v) => patch({ backgroundColor: v === "ai" ? null : "#0A0A23" })}
              options={[{ value: "ai", label: "AI picks background" }, { value: "custom", label: "Custom background" }]}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
            <ColorField label="Primary" value={state.primaryColor} onChange={(v) => patch({ primaryColor: v })} />
            <ColorField label="Secondary" value={state.secondaryColor} onChange={(v) => patch({ secondaryColor: v })} />
            <ColorField label="Accent" value={state.accentColor} onChange={(v) => patch({ accentColor: v })} />
            <ColorField
              label="Background"
              value={state.backgroundColor ?? "#FFFFFF"}
              disabled={state.backgroundColor === null}
              onChange={(v) => patch({ backgroundColor: v })}
            />
          </div>
          </Section>

        {/* ===== Fonts ===== */}
        <Section icon={<Type size={15} />} title="Fonts">
  <div className="grid grid-cols-2 gap-3">
  <div>
    <label className={LABEL}>Heading</label>
    <Select value={state.headingFont} options={toOpts(HEADING_FONTS)} onChange={(v) => patch({ headingFont: v })} fontPreview muted />
  </div>
  <div>
    <label className={LABEL}>Body</label>
    <Select value={state.bodyFont} options={toOpts(BODY_FONTS)} onChange={(v) => patch({ bodyFont: v })} fontPreview muted />
  </div>
</div>
        </Section>

        {/* ===== Logo ===== */}
        <Section icon={<ImageIcon size={15} />} title="Brand logo">
          <div className="flex flex-col gap-3.5">
            <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(ev) => onLogoFile(ev.target.files)} />
            <div className="order-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                aria-label="Upload logo"
                className={`w-full h-28 rounded-xl flex items-center justify-center overflow-hidden text-zinc-400 hover:text-zinc-600 transition-colors ${state.logo ? "bg-white border-2 border-dashed border-[#D4D4D8]" : "border-2 border-dashed border-[#D4D4D8] bg-[#F4F4F5] hover:bg-[#EDEDEF]"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {state.logo ? <img src={state.logo} alt="logo" className="max-w-full max-h-full object-contain p-3" /> : <Plus size={20} strokeWidth={1.8} />}
              </button>
          <button
  type="button"
  onClick={() => logoInput.current?.click()}
  style={{ border: "1px solid #000" }}
  className={`w-full h-10 rounded-xl text-[13px] font-semibold text-zinc-800 flex items-center justify-center gap-2 ${RAISED}`}
>
  {state.logo ? "Update logo" : "Upload logo"}
</button>
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <label className={LABEL}>Placement</label>
                <Segmented
                  value={logoAuto ? "auto" : "manual"}
                  onChange={(v) => patch({ logoPosition: v === "auto" ? "auto" : logoAuto ? "bottom-right" : state.logoPosition })}
                  options={[{ value: "auto", label: "Auto" }, { value: "manual", label: "Manual" }]}
                />
              </div>
              <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl w-[96px] ${INSET} ${logoAuto ? "opacity-40 pointer-events-none" : ""}`}>
                {LOGO_GRID.map((pos, i) =>
                  pos ? (
                    <button
                      key={pos}
                      type="button"
                      aria-label={pos}
                      onClick={() => patch({ logoPosition: pos })}
                      className={`h-7 rounded-md flex items-center justify-center transition-all ${state.logoPosition === pos ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]" : "hover:bg-white/60"}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${state.logoPosition === pos ? "bg-zinc-800" : "bg-zinc-400"}`} />
                    </button>
                  ) : (
                    <span key={i} className="h-7" />
                  )
                )}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-zinc-500">Size</label>
              <span className="text-[11px] font-semibold text-zinc-700">{state.logoScale ? `${Math.round(state.logoScale * 100)}%` : "Auto"}</span>
            </div>
            <input
              type="range" min={0} max={40} step={1}
              value={state.logoScale ? Math.round(state.logoScale * 100) : 0}
              onChange={(ev) => { const v = parseInt(ev.target.value, 10); patch({ logoScale: v === 0 ? null : v / 100 }); }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[#E1E1E4] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] accent-zinc-600"
            />
          </div>
        </Section>

        {/* ===== Single ads ===== */}
        <Section icon={<ImageIcon size={15} />} title="Single ads">
          <AdPackPicker value={state.adPackId} onChange={(v) => patch({ adPackId: v })} />
        </Section>

        {/* ===== Characters (TikTok slideshows) ===== */}
        <Section icon={<UserRound size={15} />} title="Characters">
          <CharacterSheet characters={state.characters} onChange={(characters) => patch({ characters })} />
        </Section>

        {/* ===== Negative prompt ===== */}
        <Section icon={<Ban size={15} />} title="Negative prompt">
          <textarea
            value={state.negativePrompt}
            onChange={(e) => patch({ negativePrompt: e.target.value.slice(0, 600) })}
            rows={3}
            placeholder="e.g. no people, no gradients, no emojis, no stock-photo look, no red"
            className={`${FIELD} h-auto py-2.5 resize-none`}
          />
          <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">Things that should never appear. Applied to every ad, carousel and template made for this project.</p>
        </Section>

        {/* ===== Carousel ===== */}
        <Section icon={<Layers size={15} />} title="Carousel">
          <CarouselSettings value={state.carousel} onChange={(c) => patch({ carousel: c })} />
        </Section>

        {/* ===== Language ===== */}
        <Section icon={<Languages size={15} />} title="Language">
          <label className={LABEL}>On-image text language</label>
          <Select
            muted
            value={state.language}
            onChange={(v) => patch({ language: v })}
            options={[{ value: "", label: "Default (English)" }, ...toOpts(LANGUAGES)]}
          />
          <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">Headlines and captions on the graphics will be written in this language.</p>
        </Section>

        {/* ===== Ecommerce ===== */}
        <Section
          icon={<ShoppingBag size={15} />}
          title="Ecommerce"
          right={<Toggle on={e.enabled} onChange={(v) => patchEcom({ enabled: v })} label="Toggle ecommerce" />}
        >
          {e.enabled && (
            <div className="space-y-3.5">
              <div>
                <label className={LABEL}>Product name</label>
                <input type="text" value={e.productName} onChange={(ev) => patchEcom({ productName: ev.target.value })} placeholder="e.g. Hydrating Night Serum" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Product description</label>
                <textarea value={e.productDescription} onChange={(ev) => patchEcom({ productDescription: ev.target.value })} rows={2} placeholder="What it is and why it's great" className={`${FIELD} h-auto py-2.5 resize-none`} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={LABEL}>Price</label>
                  <input type="text" value={e.price} onChange={(ev) => patchEcom({ price: ev.target.value })} placeholder="$49" className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Sale price</label>
                  <input type="text" value={e.salePrice} onChange={(ev) => patchEcom({ salePrice: ev.target.value })} placeholder="$39" className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Promo</label>
                  <input type="text" value={e.promoCode} onChange={(ev) => patchEcom({ promoCode: ev.target.value })} placeholder="SAVE20" className={FIELD} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Product image</label>
                <div className="flex items-center gap-3">
                  <input ref={productInput} type="file" accept="image/*" className="hidden" onChange={(ev) => onProductFile(ev.target.files)} />
                  <UploadTile src={e.productImage} onClick={() => productInput.current?.click()} size={56}>
                    <Plus size={14} />
                  </UploadTile>
                  {e.productImage && (
                    <button type="button" onClick={() => patchEcom({ productImage: null })} className={`h-8 px-3 rounded-lg text-xs font-semibold text-red-600 ${RAISED}`}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL}>Shop CTA</label>
                  <input type="text" value={e.shopCta} onChange={(ev) => patchEcom({ shopCta: ev.target.value })} placeholder="Shop now" className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Product URL</label>
                  <input type="text" value={e.productUrl} onChange={(ev) => patchEcom({ productUrl: ev.target.value })} placeholder="link in bio" className={FIELD} />
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ===== Save bar ===== */}
      <div className="px-5 py-4 border-t border-[#E7E7EA] bg-white">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-b from-[#52525B] to-[#27272A] border border-[#18181B] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.2),0_4px_10px_-2px_rgba(0,0,0,0.25)] hover:from-[#5C5C65] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] disabled:opacity-50 transition"
        >
          {saving ? (<><Loader2 size={15} className="animate-spin" /> Saving…</>) : savedAt ? (<><Check size={15} /> Saved</>) : "Save settings"}
        </button>
      </div>
    </div>
  );
}


// ==================== Carousel style + author ====================
function CarouselSettings({ value, onChange }: { value: ProjectCarouselSettings; onChange: (v: ProjectCarouselSettings) => void }) {
  const [styles, setStyles] = useState<{ id: string; name: string; description: string; preview: string[]; mine?: boolean }[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    fetch("/api/carousel-styles")
      .then((r) => r.json())
      .then((d) => setStyles(d.styles || []))
      .catch(() => setStyles([]));
  }, []);
  useEffect(() => load(), [load]);
  async function removeStyle(id: string) {
    if (!confirm("Delete this style?")) return;
    await fetch(`/api/carousel-styles?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (value.styleId === id) onChange({ ...value, styleId: "" });
    load();
  }
  const chosen = styles?.find((s) => s.id === value.styleId) || styles?.[0];
  return (
    <div className="space-y-3.5">
      <div>
        <label className={LABEL}>Carousel style</label>
        {styles === null ? (
          <p className="text-xs text-zinc-400">Loading styles…</p>
        ) : styles.length === 0 ? (
          <p className="text-xs text-zinc-400">No carousel styles yet.</p>
        ) : (
          <Select
            muted
            value={value.styleId || styles[0].id}
            onChange={(v) => onChange({ ...value, styleId: v })}
            options={styles.map((s) => ({ value: s.id, label: s.mine ? `${s.name} (yours)` : s.name }))}
          />
        )}
        {chosen && (
          <div className="mt-2.5">
            <div className="flex gap-1.5">
              {chosen.preview.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="w-1/3 aspect-[4/5] object-cover rounded-md border border-[#E3E3E6]" />
              ))}
            </div>
            {chosen.description && <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">{chosen.description}</p>}
            {chosen.mine && (
              <button type="button" onClick={() => removeStyle(chosen.id)} className="text-[11px] text-red-500 mt-1.5 hover:underline">Delete this style</button>
            )}
          </div>
        )}
        <button type="button" onClick={() => setCreating(true)} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900">
          <Plus className="w-3.5 h-3.5" /> Create my own style
        </button>
        {creating && (
          <CarouselStyleWizard
            onClose={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              onChange({ ...value, styleId: id });
              load();
            }}
          />
        )}
        <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">Every carousel for this project uses this style, so your page stays consistent. Your brand colours replace the style&apos;s colours.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Author name</label>
          <input type="text" value={value.authorName} onChange={(e) => onChange({ ...value, authorName: e.target.value })} placeholder="e.g. Elevated Path" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Handle</label>
          <input type="text" value={value.handle ? `@${value.handle}` : ""} onChange={(e) => onChange({ ...value, handle: e.target.value.replace(/^@+/, "").replace(/\s/g, "") })} placeholder="@yourpage" className={FIELD} />
        </div>
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">Used for &quot;Written by…&quot; on the first slide and &quot;Follow @…&quot; on the last.</p>
    </div>
  );
}


// ==================== Default reference pack for single ads ====================
function AdPackPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [packs, setPacks] = useState<{ id: string; title: string; description: string; coverImages: string[]; mine?: boolean }[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    fetch("/api/ad-packs")
      .then((r) => r.json())
      .then((d) => setPacks(d.packs || []))
      .catch(() => setPacks([]));
  }, []);
  useEffect(() => load(), [load]);
  async function removePack(id: string) {
    if (!confirm("Delete this pack?")) return;
    await fetch(`/api/ad-packs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (value === id) onChange("");
    load();
  }
  const chosen = packs?.find((p) => p.id === value);
  const AUTO = "__auto__";
  return (
    <div>
      <label className={LABEL}>Ad style (reference pack)</label>
      {packs === null ? (
        <p className="text-xs text-zinc-400">Loading…</p>
      ) : (
        <Select
          muted
          value={chosen ? value : AUTO}
          onChange={(v) => onChange(v === AUTO ? "" : v)}
          options={[{ value: AUTO, label: "Auto: the AI picks the best pack" }, ...packs.map((p) => ({ value: p.id, label: p.mine ? `${p.title} (yours)` : p.title }))]}
        />
      )}
      {chosen && chosen.coverImages.length > 0 && (
        <div className="mt-2.5 flex gap-1.5">
          {chosen.coverImages.slice(0, 3).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="w-1/3 aspect-[4/5] object-cover rounded-md border border-[#E3E3E6]" />
          ))}
        </div>
      )}
      {chosen?.mine && (
        <button type="button" onClick={() => removePack(chosen.id)} className="text-[11px] text-red-500 mt-1.5 hover:underline">Delete this pack</button>
      )}
      <button type="button" onClick={() => setCreating(true)} className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900">
        <Plus className="w-3.5 h-3.5" /> Create my own pack
      </button>
      {creating && (
        <AdPackWizard
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onChange(id);
            load();
          }}
        />
      )}
      <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
        Single ads follow the pack: the AI picks the best layout for each request and swaps in your colours, fonts and product. On Auto it chooses the best pack for the request (your own packs first, if you made any). If you&apos;ve added your own reference images above, those are used instead.
      </p>
    </div>
  );
}

function CharacterSheet({ characters, onChange }: { characters: Character[]; onChange: (c: Character[]) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">A character keeps the same person on every slide of a TikTok slideshow. Upload photos of someone you have the rights to, or let the AI make one.</p>
      {characters.length > 0 && (
        <div className="space-y-2 mb-3">
          {characters.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#E3E3E6] p-2">
              <div className="flex -space-x-2 shrink-0">
                {c.photos.slice(0, 3).map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800 truncate">{c.name}</p>
                <p className="text-[11px] text-zinc-400 truncate">{c.source === "ai" ? "AI character" : "Uploaded photos"}{c.description ? ` · ${c.description}` : ""}</p>
              </div>
              <button type="button" onClick={() => confirm(`Remove ${c.name}?`) && onChange(characters.filter((x) => x.id !== c.id))} className="p-1.5 text-zinc-400 hover:text-red-500" aria-label="Remove"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {characters.length < 6 && (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900">
          <Plus className="w-3.5 h-3.5" /> Add a character
        </button>
      )}
      {adding && <CharacterWizard onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); onChange([...characters, c]); }} />}
    </div>
  );
}
