// ============================================================
// UXLLY — Size cards
// One card per format: a rectangle drawn to the real proportions, the
// format name and its pixel size. Grouped by platform. Single select.
// ============================================================
"use client";

import { Check } from "lucide-react";
import { FORMAT_CARDS, FORMAT_PLATFORMS, type FormatCard } from "@/lib/formatCards";
import type { PlatformKey } from "@/types";

/** Rectangle drawn to scale inside a fixed box. */
export function RatioRect({ w, h, active, box = 56 }: { w: number; h: number; active?: boolean; box?: number }) {
  const s = (box - 6) / Math.max(w, h);
  const rw = Math.round(w * s);
  const rh = Math.round(h * s);
  const x = (box - rw) / 2;
  const y = (box - rh) / 2;
  return (
    <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden>
      <rect x={x} y={y} width={rw} height={rh} rx={4} fill={active ? "#111827" : "#F3F4F6"} stroke={active ? "#111827" : "#9CA3AF"} strokeWidth={1.5} />
      {rw > 22 && rh > 22 && (
        <>
          <rect x={x + 5} y={y + 5} width={rw * 0.5} height={3} rx={1.5} fill={active ? "#fff" : "#D1D5DB"} opacity={active ? 0.9 : 1} />
          <rect x={x + 5} y={y + 11} width={rw * 0.32} height={3} rx={1.5} fill={active ? "#fff" : "#D1D5DB"} opacity={active ? 0.6 : 1} />
        </>
      )}
    </svg>
  );
}

function Card({ c, on, onPick }: { c: FormatCard; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${on ? "border-gray-900 ring-2 ring-gray-900 bg-white" : "border-gray-200 bg-white hover:border-gray-400"}`}
    >
      <span className="shrink-0 w-14 h-14 flex items-center justify-center rounded-xl bg-gray-50">
        <RatioRect w={c.w} h={c.h} active={on} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold text-gray-900 truncate">{c.name}</span>
          {c.recommended && <span className="shrink-0 rounded-full bg-[#A3F76B] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-900">Best</span>}
        </span>
        <span className="block text-[12px] text-gray-500 truncate">{c.hint}</span>
        <span className="block text-[11px] text-gray-400 tabular-nums">{c.ratio} · {c.w}×{c.h}</span>
      </span>
      {on && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

export default function SizeCards({ value, onChange, only }: { value: PlatformKey | null; onChange: (k: PlatformKey) => void; only?: string[] }) {
  const groups = FORMAT_PLATFORMS.filter((p) => !only || only.includes(p));
  return (
    <div className="space-y-5">
      {groups.map((platform) => (
        <div key={platform}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{platform}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FORMAT_CARDS.filter((c) => c.platform === platform).map((c) => (
              <Card key={c.key} c={c} on={value === c.key} onPick={() => onChange(c.key)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
