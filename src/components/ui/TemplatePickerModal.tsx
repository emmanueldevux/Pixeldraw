// ============================================================
// UXLLY — Template Picker Modal
// Lets a user browse and pick one of the built-in reference
// templates (see /public/templates/ and src/lib/templates.ts)
// instead of uploading their own reference image.
// ============================================================

"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { TEMPLATE_REFERENCES } from "@/lib/templates";
import { Loader2 } from "lucide-react";

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (base64DataUrl: string) => void;
}

// Converts a public template PNG into a base64 data URL, the same
// format uploaded reference files already use — so a picked template
// flows through the exact same reference pipeline as a real upload,
// no special-casing needed anywhere downstream.
async function fetchAsBase64(publicUrl: string): Promise<string> {
  const response = await fetch(publicUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function TemplatePickerModal({ isOpen, onClose, onSelect }: TemplatePickerModalProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (templateId: string, publicUrl: string) => {
    setLoadingId(templateId);
    setError(null);
    try {
      const base64 = await fetchAsBase64(publicUrl);
      onSelect(base64);
      onClose();
    } catch (err) {
      console.error("Failed to load template:", err);
      setError("Couldn't load that template — has it been added to /public/templates/ yet?");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose a Template" size="lg">
      <div className="space-y-3">
        <p className="text-xs text-ink-500">
          No reference image handy? Pick one of these to use as a starting structure instead.
        </p>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="grid grid-cols-4 gap-3">
          {TEMPLATE_REFERENCES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handlePick(template.id, template.publicUrl)}
              disabled={loadingId !== null}
              className="relative aspect-square rounded-lg overflow-hidden border-2 border-surface-200 hover:border-brand-400 transition-colors bg-surface-100 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={template.publicUrl}
                alt={template.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Template file not added to /public/templates/ yet —
                  // show a plain placeholder instead of a broken image icon.
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                {loadingId === template.id && (
                  <Loader2 size={20} className="text-white animate-spin" />
                )}
              </div>
              <span className="absolute bottom-1 left-1 right-1 text-[10px] font-medium text-white bg-black/50 rounded px-1.5 py-0.5 truncate">
                {template.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}