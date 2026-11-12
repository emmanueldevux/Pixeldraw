"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

interface PromptFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void; 
}

export function PromptForm({ value, onChange, onSubmit }: PromptFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const hasText = value.trim().length > 0;

  function handleInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 252)}px`;
  }

  function handleBuild() {
    if (!hasText) return;
    
    if (onSubmit) {
      onSubmit();
    } else {
      router.push(`/ai?prompt=${encodeURIComponent(value.trim())}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleBuild();
    }
  }

  return (
    <div className="home-prompt-wrap">
      <div className="home-conic-border">
        
        <div className="!flex !flex-col !gap-2 !p-3 !bg-white !rounded-[24px] !min-h-0 !justify-start border border-gray-200 shadow-sm relative">
          
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Describe what you want to create and let AI do the rest"
            className="w-full bg-transparent text-[15px] text-gray-900 placeholder-gray-400 outline-none resize-none px-1 pt-1 !m-0"
            style={{ minHeight: "44px" }}
          />

          <div className="!flex !flex-row !items-center !justify-between w-full !mt-1 !m-0">
            {/* LEFT SIDE: Light Theme Pills with SVG Icons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-[0.475rem] rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-medium text-gray-700 border border-gray-200"
              >
                {/* Image Icon SVG */}
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-[0.475rem] rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-medium text-gray-700 border border-gray-200"
              >
                {/* Carousel Icon SVG */}
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Carousel
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-[0.475rem] rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-medium text-gray-700 border border-gray-200"
              >
                {/* Movie Icon SVG */}
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                TikTok slideshow
              </button>
            </div>

            {/* RIGHT SIDE: Mic & Green Send Button */}
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Use microphone" className="text-gray-400 hover:text-gray-700 transition-colors">
                {/* Mic Icon SVG */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleBuild}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  hasText 
                    ? "bg-[#A3F76B] text-black hover:bg-[#8ee05c]" 
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {/* Arrow Up Icon SVG */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}