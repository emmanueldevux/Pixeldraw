"use client";

import { useRef, useState, useEffect } from "react";

// Image-generation engines offered in the composer's "Models" dropdown.
// The selected value is sent to the API as `imageProvider` and overrides the
// server's default IMAGE_PROVIDER for that one generation.
export interface ImageModelOption {
  value: string; // "openai" | "together"
  label: string;
  hint: string;
}

export const IMAGE_MODELS: ImageModelOption[] = [
  { value: "openai", label: "GPT Image 2", hint: "Best quality · uses brand + attached product" },
  { value: "together", label: "FLUX", hint: "Fastest · ignores product/reference" },
];

interface ProjectPromptProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  // Attached product image (data URL) that gets sent to the image model.
  attachedImage?: string | null;
  onAttachImage?: (dataUrl: string | null) => void;
  // Selected image-generation model.
  imageModel?: string;
  onImageModelChange?: (value: string) => void;
}

// Downscale an uploaded image to a sane max dimension and return a PNG data
// URL (PNG keeps transparency, which matters for cut-out product images).
function fileToScaledDataUrl(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas context"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProjectPrompt({
  value,
  onChange,
  onSubmit,
  placeholder = "Describe what you want to create and let AI do the rest",
  disabled = false,
  attachedImage = null,
  onAttachImage,
  imageModel = "openai",
  onImageModelChange,
}: ProjectPromptProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelsRef = useRef<HTMLDivElement>(null);
  const [modelsOpen, setModelsOpen] = useState(false);
  const hasText = value.trim().length > 0;

  const activeModel =
    IMAGE_MODELS.find((m) => m.value === imageModel) || IMAGE_MODELS[0];

  // Close the models dropdown when clicking outside of it.
  useEffect(() => {
    if (!modelsOpen) return;
    function onDocClick(e: MouseEvent) {
      if (modelsRef.current && !modelsRef.current.contains(e.target as Node)) {
        setModelsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [modelsOpen]);

  function handleInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 252)}px`;
  }

  function handleBuild() {
    if (!hasText || disabled) return;
    if (onSubmit) {
      onSubmit();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleBuild();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !onAttachImage) return;
    try {
      const dataUrl = await fileToScaledDataUrl(file);
      onAttachImage(dataUrl);
    } catch {
      /* ignore bad file */
    }
  }

  const controlClass =
    "flex items-center gap-1.5 px-3 py-[0.475rem] rounded-xl bg-gray-50 hover:bg-gray-100 disabled:hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={`uxlly-prompt-wrapper ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <div className="uxlly-prompt-inner">

        {/* Attached product image preview */}
        {attachedImage && (
          <div className="flex items-center gap-2 mb-2">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachedImage} alt="Attached product" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => onAttachImage?.(null)}
                aria-label="Remove attached image"
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-black"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <span className="text-[11px] text-gray-500">Product image attached — it&apos;ll be added to the graphic</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-[15px] text-gray-900 placeholder-gray-400 outline-none resize-none px-1 pt-1 !m-0 disabled:cursor-not-allowed"
          style={{ minHeight: "44px" }}
        />

        <div className="flex flex-row items-center justify-between w-full mt-1">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-1.5">
            {/* Attach image (product PNG) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className={controlClass}
              title="Attach a product image to include in the graphic"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {attachedImage ? "Change" : "Attach"}
            </button>

            {/* Models dropdown (opens upward) */}
            <div className="relative" ref={modelsRef}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setModelsOpen((o) => !o)}
                className={controlClass}
                title="Choose the image-generation model"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {activeModel.label}
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>

              {modelsOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-50">
                  {IMAGE_MODELS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        onImageModelChange?.(m.value);
                        setModelsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        m.value === activeModel.value
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-800">{m.label}</p>
                      <p className="text-[10px] text-gray-400">{m.hint}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT SIDE: Mic & Send */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={disabled}
              aria-label="Use microphone"
              className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleBuild}
              disabled={!hasText || disabled}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                hasText && !disabled
                  ? "bg-[#A3F76B] text-black hover:bg-[#8ee05c] cursor-pointer"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
