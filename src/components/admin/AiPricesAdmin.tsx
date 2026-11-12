// ============================================================
// UXLLY — Admin → AI prices
// Real-cost pricing: every AI action charges what it really cost you
// × your markup, converted at your credit value. Here you set the
// markup, the providers' token prices and the minimum charge, and see
// what typical actions cost users.
// ============================================================
"use client";

import { useMemo, useState } from "react";
import { btnPrimary, inputCls } from "@/components/billing/Shell";

export interface AiPriceSettings {
  creditValueCents: number;
  markupPercent: number;
  imageTextInCentsPerM: number;
  imageImageInCentsPerM: number;
  imageOutCentsPerM: number;
  openaiTextInCentsPerM: number;
  openaiTextOutCentsPerM: number;
  textInCentsPerM: number;
  textOutCentsPerM: number;
  fluxImageMicroUsd: number;
  minChargeMilli: number;
}

// Typical token sizes per action (same assumptions the server uses for "typical").
const per = (tokens: number, dollarsPerM: number) => (tokens * dollarsPerM) / 1_000_000;

export default function AiPricesAdmin({ settings, onSave }: { settings: AiPriceSettings; onSave: (patch: Partial<AiPriceSettings>) => void }) {
  const [f, setF] = useState({
    markup: String(settings.markupPercent / 100),
    iTextIn: String(settings.imageTextInCentsPerM / 100),
    iImgIn: String(settings.imageImageInCentsPerM / 100),
    iOut: String(settings.imageOutCentsPerM / 100),
    oIn: String(settings.openaiTextInCentsPerM / 100),
    oOut: String(settings.openaiTextOutCentsPerM / 100),
    tIn: String(settings.textInCentsPerM / 100),
    tOut: String(settings.textOutCentsPerM / 100),
    flux: String(settings.fluxImageMicroUsd / 1_000_000),
    min: String(settings.minChargeMilli / 1000),
  });
  const n = (s: string) => Number(s) || 0;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const creditUsd = settings.creditValueCents / 100;

  const rows = useMemo(() => {
    const vision = per(4000, n(f.oIn)) + per(700, n(f.oOut));
    const imgOut = per(1584, n(f.iOut)); // 1024x1536 at medium
    const list = [
      { label: "Chat reply (text only)", cost: per(2500, n(f.tIn)) + per(600, n(f.tOut)) },
      { label: "Image (GPT Image, medium)", cost: per(1500, n(f.iTextIn)) + per(1500, n(f.iImgIn)) + imgOut + vision },
      { label: "Image with product photo", cost: per(1500, n(f.iTextIn)) + per(3000, n(f.iImgIn)) + imgOut + vision },
      { label: "Template product ad (9:16)", cost: per(1200, n(f.iTextIn)) + per(1500, n(f.iImgIn)) + imgOut },
      { label: "Image (FLUX)", cost: n(f.flux) },
      { label: "Brand analysis", cost: per(15000, n(f.oIn)) + per(2500, n(f.oOut)) },
      { label: "Carousel, 6 slides", cost: per(3000, n(f.tIn)) + per(2000, n(f.tOut)) + 6 * (per(1500, n(f.iTextIn)) + per(1500, n(f.iImgIn)) + imgOut) + vision },
    ];
    return list.map((r) => {
      const credits = Math.max(n(f.min), r.cost > 0 ? (r.cost * n(f.markup)) / creditUsd : n(f.min));
      return { ...r, credits, price: credits * creditUsd };
    });
  }, [f, creditUsd]);

  const field = (label: string, k: keyof typeof f, hint?: string) => (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      <input className={inputCls} value={f[k]} onChange={set(k)} inputMode="decimal" />
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-gray-600 max-w-3xl">
        Every AI action charges <b>what it really cost you × your markup</b>, converted at your credit value (1 credit = ${creditUsd.toFixed(2)}).
        The app measures the real tokens of every call. Keep the prices below in line with your providers&apos; price pages.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
          {field("Markup (× your cost)", "markup", "3 = users pay three times what the AI cost you")}
          {field("Minimum charge (credits)", "min", "Smallest charge for anything that ran")}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="font-semibold text-gray-900">OpenAI image model</h3>
          <p className="text-xs text-gray-500 mb-3">gpt-image-2, $ per 1M tokens</p>
          <div className="grid grid-cols-3 gap-3">
            {field("Text in", "iTextIn")}
            {field("Image in", "iImgIn")}
            {field("Image out", "iOut")}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="font-semibold text-gray-900">OpenAI text &amp; vision</h3>
          <p className="text-xs text-gray-500 mb-3">OPENAI_VISION_MODEL / OPENAI_CHAT_MODEL (gpt-4o-mini by default), $ per 1M tokens</p>
          <div className="grid grid-cols-2 gap-3">
            {field("Input", "oIn")}
            {field("Output", "oOut")}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="font-semibold text-gray-900">Main text model</h3>
          <p className="text-xs text-gray-500 mb-3">AI_TEXT_PROVIDER (DeepSeek by default), $ per 1M tokens</p>
          <div className="grid grid-cols-2 gap-3">
            {field("Input", "tIn")}
            {field("Output", "tOut")}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="font-semibold text-gray-900">FLUX (Together)</h3>
          <p className="text-xs text-gray-500 mb-3">$ per image. The &quot;-Free&quot; model costs you $0; the minimum charge still applies.</p>
          {field("Per image ($)", "flux")}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-2.5 font-medium">Typical action</th>
              <th className="px-4 py-2.5 font-medium text-right">Costs you</th>
              <th className="px-4 py-2.5 font-medium text-right">User pays</th>
              <th className="px-4 py-2.5 font-medium text-right">Credits</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2.5 text-gray-900">{r.label}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">${r.cost.toFixed(4)}</td>
                <td className="px-4 py-2.5 text-right">${r.price.toFixed(3)}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{r.credits.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100">Estimates from typical token counts. Real charges use the measured tokens of each run; see Activity.</p>
      </div>

      <button
        className={btnPrimary}
        onClick={() =>
          onSave({
            markupPercent: Math.round(n(f.markup) * 100),
            imageTextInCentsPerM: Math.round(n(f.iTextIn) * 100),
            imageImageInCentsPerM: Math.round(n(f.iImgIn) * 100),
            imageOutCentsPerM: Math.round(n(f.iOut) * 100),
            openaiTextInCentsPerM: Math.round(n(f.oIn) * 100),
            openaiTextOutCentsPerM: Math.round(n(f.oOut) * 100),
            textInCentsPerM: Math.round(n(f.tIn) * 100),
            textOutCentsPerM: Math.round(n(f.tOut) * 100),
            fluxImageMicroUsd: Math.round(n(f.flux) * 1_000_000),
            minChargeMilli: Math.round(n(f.min) * 1000),
          })
        }
      >
        Save AI prices
      </button>
    </div>
  );
}
