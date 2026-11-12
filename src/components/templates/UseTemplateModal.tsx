// ============================================================
// UXLLY — "Use template" popup
// Upload the product, optionally fill the template's fields, choose a
// style (or let the AI pick), pick the project whose brand voice to use,
// then generate. Out of credits → top-up popup.
// ============================================================
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ImagePlus, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useAuthGate } from "@/components/auth/AuthGate";
import { useBilling } from "@/components/billing/BillingProvider";
import { formatCredits } from "@/lib/billing/units";
import type { PublicTemplate } from "@/lib/designTemplates/types";

const input = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-900";
const chip = (on: boolean) =>
  `px-3 py-2 rounded-xl border text-sm font-medium text-left transition-all ${on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-400 hover:bg-white"}`;

/** Shrink big phone photos before upload (keeps the pack sharp, cuts the payload). */
async function toDataUrl(file: File, max = 1600): Promise<string> {
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 3_000_000) return src;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.92);
}

export default function UseTemplateModal({ template, onClose }: { template: PublicTemplate & { typicalMilli?: number }; onClose: () => void }) {
  const { isAuthenticated, requireAuth } = useAuthGate();
  const { openTopUp, refresh } = useBilling();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [product, setProduct] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [styleKey, setStyleKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [charged, setCharged] = useState<{ milli: number; free: boolean } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.data || []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }));
        setProjects(list);
        if (list[0]) setBrandId((cur) => cur || list[0].id);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  async function pickFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("That isn't an image.");
    setErr(null);
    try {
      setProduct(await toDataUrl(f));
    } catch {
      setErr("Couldn't read that image. Try another one.");
    }
  }

  async function generate() {
    if (!isAuthenticated) {
      requireAuth(() => {});
      return;
    }
    if (template.needsProduct && !product) return setErr("Upload a photo of your product first.");
    if (template.kind === "pack" && !(values.Brief || "").trim()) return setErr("Tell us what the ad is for.");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/design-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, productImage: product, values, styleKey, brandId: brandId || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 402) {
        openTopUp({ reason: "out_of_credits", neededMilli: d.neededMilli });
        return;
      }
      if (!res.ok) throw new Error(d.error || "Something went wrong");
      setResult(d.imageUrl);
      setCharged({ milli: d.chargedMilli ?? 0, free: !!d.free });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `${template.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    a.target = "_blank";
    a.click();
  }

  const cover = template.coverImages[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]">
        {/* Left: example / result */}
        <div className="hidden md:flex md:w-[40%] bg-gray-50 items-center justify-center p-6 relative">
          {busy ? (
            <div className="flex flex-col items-center text-center gap-3">
              <Loader2 className="animate-spin text-gray-500" size={28} />
              <p className="text-sm font-semibold text-gray-900">Art-directing your ad…</p>
              <p className="text-xs text-gray-500 max-w-[220px]">Picking a style, keeping your pack exact. This takes about a minute.</p>
            </div>
          ) : result ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result} alt="Your design" className="max-h-[78vh] w-auto rounded-xl shadow-lg" />
          ) : cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={template.title} className="max-h-[78vh] w-auto rounded-xl shadow" />
          ) : (
            <Placeholder template={template} />
          )}
        </div>

        {/* Right: form */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-7 pt-6 pb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Template {template.number} · {template.aspect}</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">{template.title}</h2>
            </div>
            <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close"><X size={18} /></button>
          </div>

          {result ? (
            <div className="flex-1 overflow-y-auto px-7 pb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="Your design" className="md:hidden w-full rounded-xl mb-4" />
              <p className="text-sm text-gray-600">Your design is ready. Download it, or generate another version: each run can pick a different style.</p>
              {charged && <p className="mt-2 text-xs text-gray-500">{charged.free ? "Used one of your free images." : `Charged ${formatCredits(charged.milli)} credits.`}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={download} className="h-11 px-5 rounded-xl bg-[#2B2B2B] hover:bg-black text-white text-sm font-semibold inline-flex items-center gap-2"><Download size={16} /> Download</button>
                <button onClick={generate} disabled={busy} className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50 inline-flex items-center gap-2"><RefreshCw size={16} /> Generate again</button>
                <button onClick={() => setResult(null)} className="h-11 px-4 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 inline-flex items-center gap-2"><ArrowLeft size={16} /> Change details</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-7 pb-6 space-y-5">
                {template.description && <p className="text-sm text-gray-500">{template.description}</p>}

                {/* Product */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Product photo{template.needsProduct ? "" : " (optional)"}</p>
                  {product ? (
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product} alt="Product" className="w-16 h-16 rounded-lg object-contain bg-gray-50" />
                      <p className="flex-1 text-sm text-gray-600">Looks good. A clear, well-lit photo keeps the label sharp.</p>
                      <button onClick={() => setProduct(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Remove"><X size={16} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files); }}
                      className="w-full rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-400 bg-gray-50 py-7 flex flex-col items-center gap-2 text-sm text-gray-600"
                    >
                      <ImagePlus size={22} className="text-gray-400" />
                      <span><b className="text-gray-900">Upload</b> or drop a photo of your product</span>
                      <span className="text-xs text-gray-400">Front of the pack, label readable</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickFile(e.target.files); e.target.value = ""; }} />
                </div>

                {/* Fields */}
                {template.fields.map((f) => (
                  <div key={f.key}>
                    <p className="text-sm font-semibold text-gray-900 mb-2">{f.label}</p>
                    <input className={input} value={values[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} maxLength={300} />
                  </div>
                ))}

                {/* Style */}
                {template.styles.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-2">Style</p>
                    <div className="flex flex-wrap gap-2">
                      <button className={chip(styleKey === null)} onClick={() => setStyleKey(null)}>
                        <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> Let AI pick</span>
                      </button>
                      {template.styles.map((s) => (
                        <button key={s.key} className={chip(styleKey === s.key)} onClick={() => setStyleKey(s.key)} title={`${s.description}${s.bestFor ? ` Best for ${s.bestFor}.` : ""}`}>
                          {s.name.charAt(0) + s.name.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                    {styleKey && (
                      <p className="mt-2 text-xs text-gray-500">
                        {template.styles.find((s) => s.key === styleKey)?.bestFor && `Best for ${template.styles.find((s) => s.key === styleKey)!.bestFor}.`}
                      </p>
                    )}
                  </div>
                )}

                {/* Project (brand voice) */}
                {template.useBrandBrain && projects.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-2">Brand voice from</p>
                    <select className={input} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="">None</option>
                    </select>
                  </div>
                )}

                {err && <p className="text-sm text-red-600">{err}</p>}
              </div>

              <div className="shrink-0 border-t border-gray-100 px-7 py-4 flex items-center gap-3">
                <p className="flex-1 text-xs text-gray-500">{template.typicalMilli ? `About ${formatCredits(template.typicalMilli)} credits, based on what it takes to make. Only charged if it works.` : "Only charged if it works."}</p>
                <button
                  onClick={generate}
                  disabled={busy}
                  className="h-11 px-6 rounded-xl bg-[#A3F76B] hover:bg-[#8ee05c] text-black text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {busy ? "Generating…" : "Generate"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Placeholder({ template }: { template: PublicTemplate }) {
  return (
    <div className="w-full aspect-[9/16] max-h-[70vh] rounded-xl overflow-hidden relative flex flex-col justify-end p-5 text-white"
      style={{ background: "radial-gradient(120% 90% at 80% 10%, #ff9a5a 0%, #e5484d 35%, #5b1a7a 75%, #1b0b2e 100%)" }}>
      <Sparkles className="absolute top-5 left-5 opacity-80" size={22} />
      <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Template {template.number}</p>
      <p className="mt-1 text-2xl font-black leading-tight">{template.title}</p>
      {template.styles.length > 0 && <p className="mt-2 text-xs opacity-80">{template.styles.length} ad styles · AI picks the best one</p>}
    </div>
  );
}
