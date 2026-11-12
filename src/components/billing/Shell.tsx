"use client";
// Light-theme modal shell used by all billing popups (OpenAI-style: title, body, footer buttons).
import { useEffect, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";

export function Shell({
  title,
  onClose,
  onBack,
  children,
  footer,
  width = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onMouseDown={onClose}>
      <div
        className={`w-full ${width} max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-6 pt-5">
          {onBack && (
            <button onClick={onBack} className="p-1 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          <h3 className="text-lg font-semibold text-gray-900 flex-1">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="px-6 pb-5 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const btnPrimary =
  "h-10 px-5 rounded-lg bg-[#2B2B2B] hover:bg-black text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnSecondary =
  "h-10 px-5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-sm font-semibold transition-colors disabled:opacity-50";
export const inputCls =
  "w-full h-11 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900";

export function CardLabel({ brand, last4 }: { brand: string; last4: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px] font-bold uppercase text-gray-700">{brand}</span>
      <span className="text-sm text-gray-900">•••• {last4}</span>
    </span>
  );
}
