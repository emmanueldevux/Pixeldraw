// ============================================================
// UXLLY — Clarifying questions popup
// The AI asks only when something is unclear (no topic, an image with no
// instruction, no size chosen yet). Each question: pick an option, or
// type an answer.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";

export interface ClarifyOption {
  value: string;
  label: string;
  description?: string;
}
export interface ClarifyQuestion {
  id: string;
  question: string;
  options?: ClarifyOption[];
  /** show a text box (alone, or as "Other" under the options) */
  text?: { placeholder: string; required?: boolean };
}

export default function ClarifyModal({
  title = "A couple of quick questions",
  questions,
  onSubmit,
  onCancel,
}: {
  title?: string;
  questions: ClarifyQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.options?.[0]?.value && !q.text?.required ? q.options[0].value : ""])),
  );
  const [typed, setTyped] = useState<Record<string, string>>({});

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  const value = (q: ClarifyQuestion) => (typed[q.id]?.trim() ? typed[q.id].trim() : answers[q.id]);
  const ready = questions.every((q) => !!value(q));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <div className="w-7 h-7 rounded-lg bg-[#A3F76B] flex items-center justify-center"><Sparkles size={15} /></div>
            {title}
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-6">
          {questions.map((q) => (
            <div key={q.id}>
              <p className="text-[15px] font-semibold text-gray-900">{q.question}</p>
              {q.options && (
                <div className="mt-3 grid gap-2">
                  {q.options.map((o) => {
                    const on = !typed[q.id]?.trim() && answers[q.id] === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setAnswers({ ...answers, [q.id]: o.value });
                          setTyped({ ...typed, [q.id]: "" });
                        }}
                        className={`text-left rounded-xl border px-4 py-3 transition-colors flex items-start gap-3 ${on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-white"}`}
                      >
                        <span className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${on ? "border-white bg-white" : "border-gray-300"}`}>
                          {on && <Check size={11} strokeWidth={3} className="text-gray-900" />}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{o.label}</span>
                          {o.description && <span className={`block text-xs ${on ? "text-white/70" : "text-gray-500"}`}>{o.description}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {q.text && (
                <input
                  className="mt-3 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-gray-900"
                  placeholder={q.options ? `Other: ${q.text.placeholder}` : q.text.placeholder}
                  value={typed[q.id] || ""}
                  onChange={(e) => setTyped({ ...typed, [q.id]: e.target.value })}
                  autoFocus={!q.options}
                  onKeyDown={(e) => e.key === "Enter" && ready && onSubmit(Object.fromEntries(questions.map((x) => [x.id, value(x)])))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end gap-2">
          <button onClick={onCancel} className="h-11 px-4 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
          <button
            disabled={!ready}
            onClick={() => onSubmit(Object.fromEntries(questions.map((q) => [q.id, value(q)])))}
            className="h-11 px-6 rounded-xl bg-[#A3F76B] hover:bg-[#8ee05c] text-black text-sm font-semibold disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
