// ============================================================
// UXLLY — Light-theme building blocks
// The shared Card/Input/Button/Select were built for the old dark theme.
// These are plain-Tailwind light versions with the same props, used by the
// calendar, settings, wizards and popups.
// ============================================================
"use client";

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const FIELD = "w-full rounded-xl border border-gray-200 bg-white px-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-400";

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-gray-800">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const LInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }>(
  ({ label, hint, error, className, ...p }, ref) => (
    <Field label={label} hint={hint} error={error}>
      <input ref={ref} className={cx(FIELD, "h-12", className)} {...p} />
    </Field>
  ),
);
LInput.displayName = "LInput";

export const LTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }>(
  ({ label, hint, className, ...p }, ref) => (
    <Field label={label} hint={hint}>
      <textarea ref={ref} className={cx(FIELD, "py-3 resize-none", className)} {...p} />
    </Field>
  ),
);
LTextarea.displayName = "LTextarea";

export function LSelect({ label, hint, options, className, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string; options: { value: string; label: string }[] }) {
  return (
    <Field label={label} hint={hint}>
      <select className={cx(FIELD, "h-12", className)} {...p}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

const BTN = {
  primary: "bg-gray-900 text-white hover:bg-black",
  lime: "bg-[#A3F76B] text-black hover:bg-[#8ee05c]",
  secondary: "bg-white text-gray-900 border border-gray-200 hover:border-gray-400",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
  danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
};
const SZ = { sm: "h-9 px-3.5 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-[15px]" };

export function LButton({ variant = "primary", size = "md", icon, loading, children, className, disabled, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: keyof typeof SZ; icon?: ReactNode; loading?: boolean }) {
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed", BTN[variant], SZ[size], className)}
      disabled={disabled || loading}
      {...p}
    >
      {loading ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function LCard({ className, children, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-gray-200 bg-white p-5 shadow-sm", className)} {...p}>
      {children}
    </div>
  );
}

const BADGE = {
  neutral: "bg-gray-100 text-gray-600",
  success: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
};
export function LBadge({ tone = "neutral", children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", BADGE[tone])}>{children}</span>;
}

/** Pill chip used for single/multi choice. */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx("px-3.5 py-2 rounded-full text-[13px] font-medium border transition-colors", on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400")}>
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx("relative h-6 w-11 rounded-full transition-colors", on ? "bg-gray-900" : "bg-gray-300")}>
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}
