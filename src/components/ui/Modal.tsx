// ============================================================
// UXLLY — Modal Component
// ============================================================

"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="uxlly-overlay" onClick={onClose}>
      <div
        className={cn("uxlly-modal", sizes[size])}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================== Modal Header ==================== */}
        {title && (
          <div className="uxlly-modal-header">
            <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-surface-100 text-ink-400 hover:text-ink-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* ==================== Modal Body ==================== */}
        <div className="uxlly-modal-body">{children}</div>

        {/* ==================== Modal Footer ==================== */}
        {footer && <div className="uxlly-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
