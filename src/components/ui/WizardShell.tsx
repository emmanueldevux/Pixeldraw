// ============================================================
// UXLLY — Wizard popup shell (same look as the sign-up business details popup)
// Header with title + progress bars, scrolling body, footer with Back / Skip /
// Continue. Used by the project, automation and plan wizards.
// ============================================================
"use client";

import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";

export interface ShellStep {
  id: string;
  title: string;
  sub?: string;
}

export default function WizardShell({
  heading,
  steps,
  index,
  done,
  doneTitle,
  doneText,
  busy,
  continueDisabled,
  finishLabel = "Finish",
  skippable,
  onBack,
  onNext,
  onSkip,
  onClose,
  wide,
  children,
  doneAction,
}: {
  heading: string;
  steps: ShellStep[];
  index: number;
  done?: boolean;
  doneTitle?: string;
  doneText?: string;
  busy?: boolean;
  continueDisabled?: boolean;
  finishLabel?: string;
  skippable?: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
  doneAction?: ReactNode;
}) {
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", esc);
    };
  }, [onClose, busy]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && onClose()} aria-hidden />
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-xl"} bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]`}>
        <div className="shrink-0 px-7 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <div className="w-7 h-7 rounded-lg bg-[#A3F76B] flex items-center justify-center"><Sparkles size={15} className="text-gray-900" /></div>
              {heading}
            </div>
            <div className="flex items-center gap-3">
              {!done && <span className="text-xs text-gray-400">Step {index + 1} of {steps.length}</span>}
              {!busy && (
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close"><X size={16} /></button>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            {steps.map((s, n) => (
              <div key={s.id} title={s.title} className={`h-1 flex-1 rounded-full transition-colors ${done || n <= index ? "bg-gray-900" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center text-center px-8 py-12">
            <span className="w-14 h-14 rounded-full bg-[#A3F76B] flex items-center justify-center"><Check size={28} strokeWidth={3} /></span>
            <h2 className="mt-5 text-2xl font-bold text-gray-900 tracking-[-0.02em]">{doneTitle || "All set"}</h2>
            {doneText && <p className="mt-2 text-sm text-gray-500 max-w-sm">{doneText}</p>}
            {doneAction && <div className="mt-6">{doneAction}</div>}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-7 pt-2 pb-6">
              <h2 className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{step.title}</h2>
              {step.sub && <p className="mt-1.5 text-sm text-gray-500">{step.sub}</p>}
              <div className="mt-6">{children}</div>
            </div>
            <div className="shrink-0 border-t border-gray-100 px-7 py-4 flex items-center gap-2">
              {index > 0 && (
                <button onClick={onBack} disabled={busy} className="h-11 px-3 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 inline-flex items-center gap-1.5"><ArrowLeft size={16} /> Back</button>
              )}
              <div className="flex-1" />
              {skippable && !last && (
                <button onClick={onSkip} disabled={busy} className="h-11 px-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-900">Skip</button>
              )}
              <button onClick={onNext} disabled={busy || continueDisabled} className="h-11 px-6 rounded-xl bg-[#A3F76B] hover:bg-[#8ee05c] text-black text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                {last ? (busy ? "Working…" : finishLabel) : "Continue"} {!last && <ArrowRight size={16} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
