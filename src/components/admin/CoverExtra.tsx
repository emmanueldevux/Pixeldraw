// Shared bits for the style editors: the "cover" star on a reference image and
// the one optional extra-prompt box.
"use client";

import { Star } from "lucide-react";
import { inputCls } from "@/components/billing/Shell";

export function CoverStar({ on, onPick }: { on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      title={on ? "This is the cover" : "Use as the cover image"}
      aria-label={on ? "Cover image" : "Set as cover image"}
      className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center ${on ? "bg-amber-400 text-white" : "bg-black/60 text-white opacity-0 group-hover:opacity-100"}`}
    >
      <Star size={13} fill={on ? "currentColor" : "none"} />
    </button>
  );
}

export function ExtraPrompt({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Extra prompt (optional)</span>
      <textarea
        className={`${inputCls} h-24 text-sm`}
        value={value}
        maxLength={2000}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Anything else the AI should always follow for this style. Users never see this."
      />
      <p className="mt-1 text-xs text-gray-500">Click the star on any image to make it the cover shown on the templates page.</p>
    </div>
  );
}
