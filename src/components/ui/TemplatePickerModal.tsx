// ============================================================
// UXLLY — Template Picker Modal
// Lets a user browse and pick one of the built-in reference
// templates (whatever's actually in /public/templates/, scanned
// dynamically — any filenames, any common image format) instead
// of uploading their own reference image.
// ============================================================

"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { Loader2 } from "lucide-react";
import type { TemplateReference } from "@/lib/templates";

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (base64DataUrl: string) => void;
}

// Converts a public template image into a base64 data URL, the same
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
  const [templates, setTemplates] = useState<TemplateReference[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setListLoading(true);
    setError(null);
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setTemplates(data.templates);
        else setError("Couldn't load templates.");
      })
      .catch(() => setError("Couldn't load templates."))
      .finally(() => setListLoading(false));
  }, [isOpen]);

  const handlePick = async (templateId: string, publicUrl: string) => {
    setLoadingId(templateId);
    setError(null);
    try {
      const base64 = await fetchAsBase64(publicUrl);
      onSelect(base64);
      onClose();
    } catch (err) {
      console.error("Failed to load template:", err);
      setError("Couldn't load that template.");
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

        {listLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="text-ink-300 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-xs text-ink-400 text-center py-10">
            No templates found yet — add some image files to /public/templates/ on the server.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {templates.map((template) => (
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
        )}
      </div>
    </Modal>
  );
}