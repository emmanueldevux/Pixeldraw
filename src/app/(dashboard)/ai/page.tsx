// ============================================================
// UXLLY — AI Studio Page
// Chat panel (left) + Generation preview panel (right)
// Project selector loads brand style guide for context
// ============================================================

"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Send,
  Image as ImageIcon,
  Download,
  RefreshCw,
  Sparkles,
  ChevronDown,
  FolderKanban,
  Layers,
  Video,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import TikTokSlideshowModal, {
  type TikTokCtaGoal,
  type TikTokSlideshowParams,
} from "@/components/ai/TikTokSlideshowModal";
import TikTokSlideEditor, { type TikTokDisclosure } from "@/components/ai/TikTokSlideEditor";
import type { ChatMessage, PlatformKey, CarouselSlideMessage } from "@/types";
import { PLATFORM_PRESETS } from "@/lib/platforms";
import { extractImagePrompt } from "@/lib/utils";

// ==================== Project Types ====================
interface ProjectChannel {
  id: string;
  name: string;
  platform: string;
  description: string | null;
  brand: {
    id: string;
    name: string;
    createdAt?: string;
    styleGuide: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
      backgroundColor?: string | null;
      headingFont: string;
      tone: string;
      extraNotes: string | null;
      referenceImages: string[] | null;
    } | null;
  };
}

function AIStudioPageInner() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const searchParams = useSearchParams();

  // Pre-fills from /home's prompt entry point (?prompt=...). Deliberately
  // does NOT auto-send — a channel/platform still needs to be selected,
  // and the user should see what's about to be sent before it goes.
  useEffect(() => {
    const prefill = searchParams.get("prompt");
    if (prefill) setInput(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlideMessage[] | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showCarouselModal, setShowCarouselModal] = useState(false);
  const [carouselTopic, setCarouselTopic] = useState("");
  const [carouselSlideCount, setCarouselSlideCount] = useState<string>("auto");
  const [carouselCtaGoal, setCarouselCtaGoal] = useState("");
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  // Set when the latest generation is a TikTok slideshow; the right panel
  // then shows the text editor instead of the plain carousel preview.
  const [tiktokSet, setTiktokSet] = useState<{
    slides: CarouselSlideMessage[];
    disclosure: TikTokDisclosure | null;
  } | null>(null);
  const [selectedPlatform, setSelectedPlatform] =
    useState<PlatformKey>("instagram_post");
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ==================== Project State ====================
  const [channels, setChannels] = useState<ProjectChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ProjectChannel | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const platform = PLATFORM_PRESETS[selectedPlatform];

  // ==================== Fetch Projects ====================
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success) {
        const allChannels: ProjectChannel[] = [];
        for (const brand of data.data || []) {
          for (const ch of brand.channels || []) {
            allChannels.push({
              ...ch,
              brand: {
                id: brand.id,
                name: brand.name,
                createdAt: brand.createdAt,
                styleGuide: brand.styleGuide || null,
              },
            });
          }
        }
        setChannels(allChannels);
        // Auto-select first channel
        if (allChannels.length > 0 && !selectedChannel) {
          setSelectedChannel(allChannels[0]);
          // Match platform to channel
          const key = allChannels[0].platform as PlatformKey;
          if (PLATFORM_PRESETS[key]) setSelectedPlatform(key);
        }
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  }, [selectedChannel]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ==================== Auto-scroll on new messages ====================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ==================== Auto-resize textarea ====================
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // ==================== Send Message ====================
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    // Detect a carousel request in plain chat — "make a 6-slide carousel
    // about X" — and route to the carousel pipeline instead of a single
    // image. Slide count is optional; the planner decides if omitted.
    const carouselMatch = input.match(/carousel/i);
    if (carouselMatch) {
      const slideCountMatch = input.match(/(\d+)\s*-?\s*slides?/i);
      const slideCount = slideCountMatch ? parseInt(slideCountMatch[1], 10) : undefined;
      await handleGenerateCarousel(input.trim(), slideCount);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const loadingMsg: ChatMessage = {
      id: "loading",
      role: "assistant",
      content: "",
      createdAt: new Date(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, loadingMsg]);

    try {
      // Build style context from selected project
      const sg = selectedChannel?.brand?.styleGuide;

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          platform: selectedPlatform,
          brandId: selectedChannel?.brand?.id,
          brandName: selectedChannel?.brand?.name || "My Brand",
          channelDescription: selectedChannel?.description || undefined,
          styleGuide: sg ? {
            primaryColor: sg.primaryColor,
            secondaryColor: sg.secondaryColor,
            accentColor: sg.accentColor,
            headingFont: sg.headingFont,
            tone: sg.tone,
            extraNotes: sg.extraNotes,
          } : undefined,
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + "-ai",
        role: "assistant",
        content: data.content || "Sorry, something went wrong.",
        imageUrl: data.imageUrl || null,
        createdAt: new Date(),
      };

      setMessages((prev) =>
        prev.filter((m) => m.id !== "loading").concat(assistantMessage)
      );

      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl); setCarouselSlides(null);
      }

      const prompt = extractImagePrompt(data.content);
      if (prompt && !data.imageUrl) {
        handleGenerateImage(prompt);
      }
    } catch {
      setMessages((prev) =>
        prev.filter((m) => m.id !== "loading").concat({
          id: Date.now().toString() + "-err",
          role: "assistant",
          content: "Something went wrong. Please try again.",
          createdAt: new Date(),
        })
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================== Generate Image ====================
  const handleGenerateImage = async (prompt: string) => {
    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          size: `${platform.width}x${platform.height}`,
        }),
      });

      const data = await response.json();
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl); setCarouselSlides(null);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-img",
            role: "assistant",
            content: "Here's the generated image:",
            imageUrl: data.imageUrl,
            createdAt: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error("Image generation failed:", err);
    }
  };

  // ==================== Generate TikTok Slideshow ====================
  const TIKTOK_CTA_TEXT: Record<TikTokCtaGoal, string | undefined> = {
    save: "Save this for your next check.",
    follow: "Follow for the next tip.",
    try_tool: "Try it from the link in bio.",
    none: undefined,
  };

  const handleGenerateTikTokSlideshow = (params: TikTokSlideshowParams) => {
    setShowTikTokModal(false);
    handleGenerateCarousel(
      params.topic,
      params.slideCount,
      TIKTOK_CTA_TEXT[params.ctaGoal],
      undefined,
      {
        platform: "tiktok",
        format: "tiktok_slideshow",
        clientName: params.clientName,
        brandedContent: params.brandedContent,
      }
    );
  };

  // ==================== Generate Carousel ====================
  const handleGenerateCarousel = async (
    topic: string,
    slideCount?: number,
    ctaGoal?: string,
    carouselReferenceImages?: string[],
    options?: {
      platform?: PlatformKey;
      format?: "carousel" | "tiktok_slideshow";
      clientName?: string;
      brandedContent?: boolean;
    }
  ) => {
    if (!selectedChannel) return;

    setInput("");
    setLoading(true);
    setShowCarouselModal(false);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: topic,
      createdAt: new Date(),
    };
    const loadingMsg: ChatMessage = {
      id: "loading",
      role: "assistant",
      content: "",
      createdAt: new Date(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, userMessage, loadingMsg]);

    try {
      const response = await fetch("/api/ai/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: selectedChannel.brand.id,
          topic,
          platform: options?.platform ?? selectedPlatform,
          slideCount,
          ctaGoal,
          referenceImages: carouselReferenceImages && carouselReferenceImages.length > 0 ? carouselReferenceImages : undefined,
          format: options?.format ?? "carousel",
          clientName: options?.clientName,
          brandedContent: options?.brandedContent,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Carousel generation failed");
      }

      const slides: CarouselSlideMessage[] = data.data.slides;
      const successCount = slides.filter((s) => s.imageUrl).length;

      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + "-carousel",
        role: "assistant",
        content: `Here's your ${slides.length}-slide carousel${successCount < slides.length ? ` (${successCount}/${slides.length} slides generated)` : ""}:`,
        carouselSlides: slides,
        createdAt: new Date(),
      };
      setMessages((prev) => prev.filter((m) => m.id !== "loading").concat(assistantMessage));

      setCarouselSlides(slides);
      setTiktokSet(
        data.data.format === "tiktok_slideshow"
          ? { slides, disclosure: data.data.disclosure ?? null }
          : null
      );
      setActiveSlideIndex(0);
      const firstGood = slides.find((s) => s.imageUrl);
      setGeneratedImage(firstGood?.imageUrl || null);
    } catch (err) {
      console.error("Carousel generation failed:", err);
      setMessages((prev) =>
        prev.filter((m) => m.id !== "loading").concat({
          id: Date.now().toString() + "-err",
          role: "assistant",
          content: "Something went wrong generating the carousel. Please try again.",
          createdAt: new Date(),
        })
      );
    } finally {
      setLoading(false);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ==================== Ref count for badge ====================
  const refCount = selectedChannel?.brand?.styleGuide?.referenceImages?.length || 0;

  return (
    <div className="uxlly-chat-container">
      {/* ============================================================
         LEFT: Chat Panel
         ============================================================ */}
      <div className="uxlly-chat-panel">
        {/* ==================== Chat Header ==================== */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 bg-surface-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={18} className="text-brand-500 shrink-0" />
            <h2 className="text-sm font-semibold text-ink-900 truncate">AI Studio</h2>
          </div>

          {/* ==================== Project Selector ==================== */}
          <div className="relative">
            <button
              onClick={() => setShowProjectPicker(!showProjectPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-ink-700 hover:bg-surface-50 transition-colors max-w-[200px]"
            >
              <FolderKanban size={12} className="text-ink-400 shrink-0" />
              {selectedChannel?.brand?.styleGuide?.primaryColor && (
                <span
                  className="shrink-0 w-2 h-2 rounded-full border border-surface-200"
                  style={{ background: selectedChannel.brand.styleGuide.primaryColor }}
                />
              )}
              <span className="truncate">
                {selectedChannel ? selectedChannel.name : "Select project"}
              </span>
              {refCount > 0 && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-brand-100 text-brand-600 text-[10px] flex items-center justify-center font-semibold">
                  {refCount}
                </span>
              )}
              <ChevronDown size={12} className="text-ink-400 shrink-0" />
            </button>

            {showProjectPicker && (
              <div className="absolute left-0 top-full mt-1 bg-surface-0 border border-surface-200 rounded-xl shadow-modal p-2 z-10 w-80 max-h-96 overflow-y-auto">
                {channels.length === 0 && (
                  <p className="text-xs text-ink-400 px-3 py-2">No projects yet. Create one first.</p>
                )}
                {channels.map((ch) => {
                  const sg = ch.brand.styleGuide;
                  const swatches: { label: string; color: string }[] = [];
                  if (sg?.primaryColor) swatches.push({ label: "P", color: sg.primaryColor });
                  if (sg?.accentColor) swatches.push({ label: "A", color: sg.accentColor });
                  if (sg?.backgroundColor) swatches.push({ label: "B", color: sg.backgroundColor });
                  let createdLabel = "";
                  try {
                    if (ch.brand.createdAt) {
                      createdLabel = formatDistanceToNow(new Date(ch.brand.createdAt), { addSuffix: true });
                    }
                  } catch {
                    createdLabel = "";
                  }

                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setSelectedChannel(ch);
                        const key = ch.platform as PlatformKey;
                        if (PLATFORM_PRESETS[key]) setSelectedPlatform(key);
                        setShowProjectPicker(false);
                      }}
                      className={`w-full flex flex-col gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                        ch.id === selectedChannel?.id
                          ? "bg-brand-50 text-brand-600"
                          : "text-ink-600 hover:bg-surface-50"
                      }`}
                    >
                      <div className="w-full flex items-center justify-between">
                        <div className="text-left">
                          <p className="font-medium">{ch.name}</p>
                          <p className="text-ink-400">
                            {ch.brand.name}
                            <span className="text-[9px] text-ink-300"> · id …{ch.brand.id.slice(-6)}</span>
                          </p>
                        </div>
                        <Badge variant="neutral">{ch.platform}</Badge>
                      </div>
                      {swatches.length > 0 && (
                        <div className="w-full flex flex-wrap items-center gap-2 pl-0.5">
                          {swatches.map((s) => (
                            <span key={s.label} className="flex items-center gap-1 text-[9px] text-ink-400 font-mono">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-surface-200 shrink-0"
                                style={{ background: s.color }}
                              />
                              {s.label}:{s.color}
                            </span>
                          ))}
                        </div>
                      )}
                      {createdLabel && (
                        <p className="text-[9px] text-ink-300 pl-0.5">Created {createdLabel}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ==================== Style Context Bar ==================== */}
        {selectedChannel?.brand?.styleGuide && (
          <div className="px-4 py-2 bg-brand-50/50 border-b border-brand-100 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-brand-600 font-semibold uppercase tracking-wider">Style:</span>
            {selectedChannel.brand.styleGuide.primaryColor && (
              <div className="w-3 h-3 rounded-full border border-brand-200" style={{ background: selectedChannel.brand.styleGuide.primaryColor }} />
            )}
            {selectedChannel.brand.styleGuide.accentColor && (
              <div className="w-3 h-3 rounded-full border border-brand-200" style={{ background: selectedChannel.brand.styleGuide.accentColor }} />
            )}
            {selectedChannel.brand.styleGuide.tone && (
              <span className="text-[10px] text-brand-500">{selectedChannel.brand.styleGuide.tone}</span>
            )}
            {refCount > 0 && (
              <span className="text-[10px] text-brand-500">{refCount} refs</span>
            )}
            {selectedChannel.brand.styleGuide.extraNotes && (
              <span className="text-[10px] text-ink-400 truncate max-w-[200px]">{selectedChannel.brand.styleGuide.extraNotes}</span>
            )}
          </div>
        )}

        {/* ==================== Messages ==================== */}
        <div className="uxlly-chat-messages">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-brand-500" />
              </div>
              <h3 className="text-lg font-semibold text-ink-900 mb-1">
                What should we create?
              </h3>
              <p className="text-sm text-ink-400 max-w-xs">
                {selectedChannel
                  ? `Creating for ${selectedChannel.brand.name} on ${selectedChannel.platform}. Your style guide and references are loaded.`
                  : "Select a project above, then describe the content you need."}
              </p>

              <div className="flex flex-wrap gap-2 mt-6 max-w-sm justify-center">
                {[
                  "Create a product launch post",
                  "Design a motivational quote graphic",
                  "Write a carousel about...",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="px-3 py-1.5 rounded-full border border-surface-200 text-xs text-ink-500 hover:bg-surface-50 hover:text-ink-800 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`uxlly-message ${
                msg.role === "user"
                  ? "uxlly-message-user"
                  : "uxlly-message-assistant"
              }`}
            >
              <div className="uxlly-message-bubble">
                {msg.isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="uxlly-spinner" />
                    <span className="text-ink-400 text-sm">Thinking...</span>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Generated"
                        className="mt-3 rounded-lg max-w-full"
                      />
                    )}
                    {msg.carouselSlides && msg.carouselSlides.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {msg.carouselSlides.map((slide, i) => (
                          <button
                            key={slide.slideNumber}
                            onClick={() => {
                              setCarouselSlides(msg.carouselSlides!);
                              setActiveSlideIndex(i);
                              if (slide.imageUrl) setGeneratedImage(slide.imageUrl);
                            }}
                            className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-surface-200 hover:border-brand-400 transition-colors bg-surface-100"
                            title={`Slide ${slide.slideNumber} — ${slide.role}`}
                          >
                            {slide.imageUrl ? (
                              <img src={slide.imageUrl} alt={`Slide ${slide.slideNumber}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-red-400">failed</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ==================== Input Area ==================== */}
        <div className="uxlly-chat-input-container">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowCarouselModal(true)}
              disabled={!selectedChannel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-ink-600 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Layers size={13} />
              Create Carousel
            </button>
            <button
              onClick={() => setShowTikTokModal(true)}
              disabled={!selectedChannel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-ink-600 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Video size={13} />
              Create TikTok Slideshow
            </button>
          </div>
          <div className="uxlly-chat-input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedChannel ? `Create for ${selectedChannel.brand.name}...` : "Select a project first..."}
              className="uxlly-chat-textarea"
              rows={1}
              disabled={!selectedChannel}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || !selectedChannel}
              className="p-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================
         RIGHT: Generation Preview Panel
         ============================================================ */}
      {tiktokSet ? (
        <div className="uxlly-gen-panel hidden lg:flex flex-col">
          <TikTokSlideEditor slides={tiktokSet.slides} disclosure={tiktokSet.disclosure} />
        </div>
      ) : (
      <div className="uxlly-gen-panel hidden lg:flex">
        <div className="uxlly-gen-panel-header">
          <h3 className="text-sm font-semibold text-ink-900">Preview</h3>

          <div className="relative">
            <button
              onClick={() => setShowPlatformPicker(!showPlatformPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-ink-700 hover:bg-surface-50 transition-colors"
            >
              {platform.name}
              <span className="text-ink-400">
                {platform.width}×{platform.height}
              </span>
              <ChevronDown size={12} className="text-ink-400" />
            </button>

            {showPlatformPicker && (
              <div className="absolute right-0 top-full mt-1 bg-surface-0 border border-surface-200 rounded-xl shadow-modal p-2 z-10 w-56 max-h-64 overflow-y-auto">
                {Object.values(PLATFORM_PRESETS).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      setSelectedPlatform(p.key);
                      setShowPlatformPicker(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                      p.key === selectedPlatform
                        ? "bg-brand-50 text-brand-600"
                        : "text-ink-600 hover:bg-surface-50"
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-ink-400">
                      {p.width}×{p.height}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="uxlly-gen-panel-canvas">
          {carouselSlides && carouselSlides.length > 0 ? (
            <div className="flex flex-col items-center gap-3 w-full">
              {carouselSlides[activeSlideIndex]?.imageUrl ? (
                <img
                  src={carouselSlides[activeSlideIndex].imageUrl}
                  alt={`Slide ${carouselSlides[activeSlideIndex].slideNumber}`}
                  className="rounded-xl shadow-card max-h-[58vh] object-contain"
                  style={{ aspectRatio: `${platform.width} / ${platform.height}` }}
                />
              ) : (
                <div className="w-full max-h-[58vh] aspect-square flex items-center justify-center rounded-xl bg-surface-100 text-xs text-red-400">
                  This slide failed to generate
                </div>
              )}
              <p className="text-xs text-ink-500 font-medium">
                Slide {carouselSlides[activeSlideIndex]?.slideNumber} of {carouselSlides.length}
                <span className="text-ink-300"> · {carouselSlides[activeSlideIndex]?.role}</span>
              </p>
              <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1">
                {carouselSlides.map((slide, i) => (
                  <button
                    key={slide.slideNumber}
                    onClick={() => setActiveSlideIndex(i)}
                    className={`shrink-0 w-10 h-10 rounded-md overflow-hidden border-2 transition-colors ${
                      i === activeSlideIndex ? "border-brand-500" : "border-surface-200 hover:border-surface-300"
                    } bg-surface-100`}
                  >
                    {slide.imageUrl ? (
                      <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-red-400">✕</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : generatedImage ? (
            <div className="relative">
              <img
                src={generatedImage}
                alt="Generated graphic"
                className="rounded-xl shadow-card max-h-[70vh] object-contain"
                style={{
                  aspectRatio: `${platform.width} / ${platform.height}`,
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
                <ImageIcon size={32} className="text-ink-300" />
              </div>
              <p className="text-sm text-ink-500 mb-1">No image yet</p>
              <p className="text-xs text-ink-400">
                Ask the AI to generate a graphic and it&apos;ll appear here
              </p>
            </div>
          )}
        </div>

        {carouselSlides && carouselSlides.length > 0 ? (
          <div className="uxlly-gen-panel-controls">
            {carouselSlides[activeSlideIndex]?.imageUrl && (
              <a
                href={carouselSlides[activeSlideIndex].imageUrl}
                download={`slide-${carouselSlides[activeSlideIndex].slideNumber}.png`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 text-xs font-medium text-ink-600 hover:bg-surface-50 transition-colors"
              >
                <Download size={14} />
                This slide
              </a>
            )}
            <button
              onClick={() => {
                carouselSlides.forEach((slide, i) => {
                  if (!slide.imageUrl) return;
                  setTimeout(() => {
                    const a = document.createElement("a");
                    a.href = slide.imageUrl;
                    a.download = `slide-${slide.slideNumber}.png`;
                    a.click();
                  }, i * 300);
                });
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors"
            >
              <Download size={14} />
              Download all ({carouselSlides.filter((s) => s.imageUrl).length})
            </button>
          </div>
        ) : generatedImage && (
          <div className="uxlly-gen-panel-controls">
            <button
              onClick={() => handleGenerateImage(input)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 text-xs font-medium text-ink-600 hover:bg-surface-50 transition-colors"
            >
              <RefreshCw size={14} />
              Regenerate
            </button>
            <a
              href={generatedImage}
              download="uxlly-generated.png"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors"
            >
              <Download size={14} />
              Download
            </a>
          </div>
        )}
      </div>
      )}

      {/* ==================== Create Carousel Modal ==================== */}
      <Modal
        isOpen={showCarouselModal}
        onClose={() => setShowCarouselModal(false)}
        title="Create Carousel"
      >
        <div className="space-y-4">
          <Input
            label="Topic"
            placeholder="e.g. 5 mistakes beginners make with SEO"
            value={carouselTopic}
            onChange={(e) => setCarouselTopic(e.target.value)}
            hint="What's this carousel about? The hook, content flow, and CTA all get planned from this."
          />

          <div>
            <label className="text-xs text-ink-600 mb-1 block">Slide count</label>
            <select
              value={carouselSlideCount}
              onChange={(e) => setCarouselSlideCount(e.target.value)}
              className="uxlly-input text-xs"
            >
              <option value="auto">Auto — AI decides based on the topic</option>
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n} slides</option>
              ))}
            </select>
          </div>

          <Input
            label="CTA goal (optional)"
            placeholder="e.g. follow for more, save this, visit link in bio"
            value={carouselCtaGoal}
            onChange={(e) => setCarouselCtaGoal(e.target.value)}
            hint="Leave blank and the AI will pick a sensible ask based on the topic."
          />

          <p className="text-xs text-ink-400">
            References: uses {selectedChannel?.brand.name || "this brand"}&apos;s existing reference pool automatically. Layout, background, and reference image are locked across all slides for a cohesive set — only content and subject vary per slide.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowCarouselModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={loading}
              disabled={!carouselTopic.trim() || !selectedChannel}
              onClick={() =>
                handleGenerateCarousel(
                  carouselTopic.trim(),
                  carouselSlideCount === "auto" ? undefined : parseInt(carouselSlideCount, 10),
                  carouselCtaGoal.trim() || undefined
                )
              }
            >
              Generate Carousel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==================== Create TikTok Slideshow Modal ==================== */}
      <TikTokSlideshowModal
        isOpen={showTikTokModal}
        onClose={() => setShowTikTokModal(false)}
        brandName={selectedChannel?.brand.name}
        loading={loading}
        onGenerate={handleGenerateTikTokSlideshow}
      />
    </div>
  );
}
export default function AIStudioPage() {
  return (
    <Suspense fallback={null}>
      <AIStudioPageInner />
    </Suspense>
  );
}