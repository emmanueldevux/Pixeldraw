// UXLLY — small light modal used by the slideshow tools
"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export default function LModal({ title, sub, onClose, children, footer, wide }: { title: string; sub?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
