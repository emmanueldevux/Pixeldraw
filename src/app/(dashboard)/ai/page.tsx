// ============================================================
// UXLLY — AI Studio Page
// One creator in the middle (welcome, chat, single prompt box)
// + Settings/Files on the right.
// Chat: gray user bubbles, plain assistant text, media in cards with
// a Download / Edit / Comment bar.
// ============================================================

"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TIKTOK_SETUP_KEY, type TikTokSetup } from "@/components/ai/TikTokWizard";
import ProjectSettings from "@/components/ai/ProjectSettings";
import CanvasLogo, { type CanvasLogoData } from "@/components/ai/CanvasLogo";
import { ChevronDown, FolderKanban, Download, Pencil, MessageCircle, Loader2, Sparkles, X, Send } from "lucide-react";
import Badge from "@/components/ui/Badge";
import TikTokSlideEditor, { type TikTokDisclosure } from "@/components/ai/TikTokSlideEditor";
import SlideshowWizard, { type SlideshowResult } from "@/components/ai/SlideshowWizard";
import type { TikTokCtaGoal, TikTokSlideshowParams } from "@/components/ai/TikTokSlideshowModal";
import { ProjectPrompt } from "@/components/projects/ProjectPrompt";
import { useAuthGate } from "@/components/auth/AuthGate";
import { useBilling } from "@/components/billing/BillingProvider";
import type { ChatMessage, PlatformKey, CarouselSlideMessage } from "@/types";
import { PLATFORM_PRESETS } from "@/lib/platforms";
import { extractImagePrompt } from "@/lib/utils";
import ClarifyModal, { type ClarifyQuestion } from "@/components/ai/ClarifyModal";
import { parseCarouselRequest } from "@/lib/carousels/request";
import type { CarouselSize, SlideImage } from "@/lib/carousels/types";

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

// ==================== Chat media card (assistant reply with image / carousel) ====================
interface ChatMediaSlide {
  imageUrl: string | null;
}

interface Props {
  text: string;
  imageUrl?: string | null;
  slides?: ChatMediaSlide[] | null;
  logo?: CanvasLogoData | null;
  aspect: string; // e.g. "1080 / 1350"
  downloadName?: string;
  /** Saved design id (enables "Redo slide" for carousels and "Caption"). */
  generationId?: string | null;
  /** Called when a single slide was redone, so the message can swap it in. */
  onSlideRedone?: (slideIndex: number, imageUrl: string) => void;
  /** Re-generate the selected image with an extra instruction. Resolve when done. */
  onEdit: (prompt: string, target: { imageUrl: string; slideIndex?: number }) => Promise<void>;
}

type Panel = null | "edit" | "comment";

const PILL = "flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors";

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function ChatMediaCard({ text, imageUrl, slides, logo, aspect, downloadName = "uxlly-gen.png", generationId, onSlideRedone, onEdit }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState(0);
  const [editPrompt, setEditPrompt] = useState("");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [redoing, setRedoing] = useState(false);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const isCarousel = !!slides && slides.length > 0;
  const currentUrl = isCarousel ? slides![selected]?.imageUrl ?? null : imageUrl ?? null;

  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));

  const submitEdit = async () => {
    if (!editPrompt.trim() || !currentUrl || busy) return;
    setBusy(true);
    try {
      await onEdit(editPrompt.trim(), { imageUrl: currentUrl, slideIndex: isCarousel ? selected : undefined });
      setEditPrompt("");
    } finally {
      setBusy(false);
    }
  };

  const redoSlide = async () => {
    if (!generationId || !isCarousel || redoing) return;
    setRedoing(true);
    setNote("");
    try {
      const r = await fetch("/api/generations/redo-slide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generationId, slideNumber: selected + 1 }) });
      const d = await r.json().catch(() => ({}));
      if (d.success) onSlideRedone?.(selected, d.data.imageUrl);
      else setNote(r.status === 402 ? "Not enough credits to redo this slide." : d.error || "Could not redo that slide.");
    } finally {
      setRedoing(false);
    }
  };

  const writeCaption = async () => {
    if (!generationId || captionBusy) return;
    setCaptionBusy(true);
    setNote("");
    try {
      const r = await fetch("/api/generations/caption", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generationId }) });
      const d = await r.json().catch(() => ({}));
      if (d.success) setCaption([d.data.caption, (d.data.hashtags || []).join(" ")].filter(Boolean).join("\n\n"));
      else setNote(r.status === 402 ? "Not enough credits for a caption." : d.error || "Could not write a caption.");
    } finally {
      setCaptionBusy(false);
    }
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    setComments((c) => [...c, comment.trim()]);
    setComment("");
  };

  return (
    <div className="flex items-start gap-3 w-full">
      <div className="w-7 h-7 rounded-full bg-gradient-to-b from-zinc-700 to-zinc-900 flex items-center justify-center shrink-0 mt-1 shadow-sm">
        <Sparkles size={13} className="text-white" />
      </div>

      <div className="min-w-0 flex-1 flex flex-col gap-2.5">
        {/* ===== Card ===== */}
        <div className="rounded-3xl bg-white border border-[#E7E7EA] shadow-[0_4px_20px_-6px_rgba(0,0,0,0.08)] p-4 max-w-[560px]">
          <p className="text-[15px] leading-relaxed text-zinc-900 mb-3.5 px-1">{text}</p>

          {isCarousel ? (
            <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1">
              {slides!.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`snap-start shrink-0 basis-[calc((100%-20px)/3)] aspect-[3/4] rounded-2xl overflow-hidden bg-[#F1F1F3] transition-all ${
                    i === selected ? "ring-2 ring-zinc-900 ring-offset-2" : "opacity-90 hover:opacity-100"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                >
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-[11px] text-red-400 px-2 text-center">Failed</span>
                  )}
                </button>
              ))}
            </div>
          ) : imageUrl ? (
            <div className="w-full max-w-[420px] mx-auto rounded-2xl overflow-hidden bg-[#F1F1F3]" style={{ aspectRatio: aspect }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Generated" className="w-full h-full object-cover" />
            </div>
          ) : null}

          {comments.length > 0 && (
            <ul className="mt-3.5 space-y-1.5">
              {comments.map((c, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl bg-[#F4F4F5] px-3 py-2 text-[13px] text-zinc-700">
                  <MessageCircle size={13} className="mt-0.5 text-zinc-400 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ===== Action bar ===== */}
        <div className="flex items-center gap-1 w-fit p-1 rounded-full bg-white border border-[#E7E7EA] shadow-[0_6px_20px_-6px_rgba(0,0,0,0.12)]">
          <button
            type="button"
            disabled={!currentUrl}
            onClick={() => {
              if (!currentUrl) return;
              download(currentUrl, isCarousel ? `uxlly-slide-${selected + 1}.png` : downloadName);
              // A download is a "keep" vote for the learning loop.
              if (generationId) fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: generationId, action: "download" }) }).catch(() => {});
            }}
            className={`${PILL} text-zinc-700 hover:bg-[#F4F4F5] disabled:opacity-40`}
          >
            <Download size={14} /> Download
          </button>
          <button type="button" onClick={() => toggle("edit")} className={`${PILL} ${panel === "edit" ? "bg-[#EDEDEF] text-zinc-900" : "text-zinc-700 hover:bg-[#F4F4F5]"}`}>
            <Pencil size={14} /> Edit
          </button>
          <button type="button" onClick={() => toggle("comment")} className={`${PILL} ${panel === "comment" ? "bg-[#EDEDEF] text-zinc-900" : "text-zinc-700 hover:bg-[#F4F4F5]"}`}>
            <MessageCircle size={14} /> Comment
          </button>
          {generationId && isCarousel && (
            <button type="button" onClick={redoSlide} disabled={redoing} className={`${PILL} text-zinc-700 hover:bg-[#F4F4F5] disabled:opacity-40`}>
              {redoing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Redo slide {selected + 1}
            </button>
          )}
          {generationId && (
            <button type="button" onClick={writeCaption} disabled={captionBusy} className={`${PILL} text-zinc-700 hover:bg-[#F4F4F5] disabled:opacity-40`}>
              {captionBusy ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} Caption
            </button>
          )}
        </div>
        {note && <p className="text-[12px] text-red-500 px-2">{note}</p>}
        {caption && (
          <div className="rounded-2xl bg-white border border-[#E7E7EA] p-3.5 max-w-[560px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-zinc-700">Caption + hashtags</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(caption)} className="text-[12px] text-zinc-500 hover:text-zinc-900">Copy</button>
            </div>
            <p className="text-[13px] text-zinc-800 whitespace-pre-wrap">{caption}</p>
          </div>
        )}

        {/* ===== Edit panel: logo placement + prompt for the same image ===== */}
        {panel === "edit" && currentUrl && (
          <div className="rounded-3xl bg-white border border-[#E7E7EA] shadow-[0_4px_20px_-6px_rgba(0,0,0,0.08)] p-4 max-w-[560px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[13px] font-semibold text-zinc-900">
                Edit {isCarousel ? `slide ${selected + 1}` : "image"}
              </span>
              <button type="button" onClick={() => setPanel(null)} className="w-6 h-6 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-[#F4F4F5] flex items-center justify-center" aria-label="Close editor">
                <X size={14} />
              </button>
            </div>

            <div className="w-full max-w-[420px] mx-auto mb-3.5">
              <CanvasLogo imageUrl={currentUrl} logo={isCarousel ? null : logo ?? null} aspect={aspect} downloadName={downloadName} />
            </div>

            <div className="flex items-end gap-2 rounded-2xl border border-[#D4D4D8] bg-white p-2 pl-3.5 focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-900/5 transition">
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); } }}
                rows={2}
                placeholder="Describe what to change on this image…"
                className="flex-1 resize-none bg-transparent text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none py-1.5"
              />
              <button
                type="button"
                onClick={submitEdit}
                disabled={busy || !editPrompt.trim()}
                className="h-9 px-3.5 rounded-xl text-[13px] font-semibold text-white flex items-center gap-1.5 bg-gradient-to-b from-[#52525B] to-[#27272A] border border-[#18181B] disabled:opacity-40 transition"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {busy ? "Editing" : "Apply"}
              </button>
            </div>
          </div>
        )}

        {/* ===== Comment panel ===== */}
        {panel === "comment" && (
          <div className="flex items-center gap-2 rounded-2xl border border-[#D4D4D8] bg-white p-2 pl-3.5 max-w-[560px] focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-900/5 transition">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
              placeholder="Add a comment…"
              className="flex-1 bg-transparent text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none h-9"
            />
            <button type="button" onClick={submitComment} disabled={!comment.trim()} className={`h-9 px-3.5 rounded-xl text-[13px] font-semibold text-zinc-800 disabled:opacity-40 bg-gradient-to-b from-white to-[#EDEDEF] border border-[#DCDCE0]`}>
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Chat message that may carry a logo overlay for its image
type StudioMessage = ChatMessage & { logo?: CanvasLogoData | null; generationId?: string | null };

const TIKTOK_CTA_TEXT: Record<TikTokCtaGoal, string | undefined> = {
  save: "Save this for your next check.",
  follow: "Follow for the next tip.",
  try_tool: "Try it from the link in bio.",
  none: undefined,
};

function AIStudioPageInner() {
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const { requireAuth, isAuthenticated } = useAuthGate();
  const { openTopUp, refresh: refreshCredits } = useBilling();
  const [input, setInput] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const prefill = searchParams.get("prompt");
    if (prefill) setInput(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("prompt")]);

  const [loading, setLoading] = useState(false);
  const [tiktokSet, setTiktokSet] = useState<{
    slides: CarouselSlideMessage[];
    disclosure: TikTokDisclosure | null;
  } | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("instagram_post");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  // Clarifying questions popup (asked only when a carousel request is unclear)
  const [slideshowAsk, setSlideshowAsk] = useState<string | null>(null);
  const [clarify, setClarify] = useState<{ questions: ClarifyQuestion[]; onSubmit: (a: Record<string, string>) => void } | null>(null);
  const [imageModel, setImageModel] = useState<string>("openai");
  // Scroll the chat panel itself (never the whole page) so new messages
  // don't bump the header/layout.
  const scrollRef = useRef<HTMLDivElement>(null);

  // ==================== Project State ====================
  const [channels, setChannels] = useState<ProjectChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ProjectChannel | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // ==================== Right Panel State ====================
  const [activeRightTab, setActiveRightTab] = useState<"settings" | "files">("settings");

  const platform = PLATFORM_PRESETS[selectedPlatform];
  const aspect = `${platform.width} / ${platform.height}`;

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
        const requestedId = searchParams.get("channel");
        const initial = allChannels.find((c) => c.id === requestedId) || allChannels[0];
        if (initial && !selectedChannel) {
          setSelectedChannel(initial);
          const key = initial.platform as PlatformKey;
          if (PLATFORM_PRESETS[key]) setSelectedPlatform(key);
        }
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  }, [selectedChannel, searchParams]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ==================== Saved chat (per project) ====================
  // Restore this project's conversation when it opens; save after every change.
  const chatLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = selectedChannel?.brand.id;
    if (!id || !isAuthenticated || chatLoadedFor.current === id) return;
    chatLoadedFor.current = null;
    fetch(`/api/chat-session?brandId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.data)) {
          setMessages((d.data as StudioMessage[]).map((m) => ({ ...m, createdAt: new Date(m.createdAt) })));
        } else setMessages([]);
        chatLoadedFor.current = id;
      })
      .catch(() => { chatLoadedFor.current = id; });
  }, [selectedChannel?.brand.id, isAuthenticated]);

  useEffect(() => {
    const id = selectedChannel?.brand.id;
    if (!id || chatLoadedFor.current !== id || messages.some((m) => m.isLoading)) return;
    const t = setTimeout(() => {
      fetch("/api/chat-session", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId: id, messages }) }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [messages, selectedChannel?.brand.id]);

  // Keep the chat pinned to the latest message by scrolling only the chat
  // container — scrolling an element with scrollIntoView would also nudge
  // ancestor scroll areas and visibly bump the page.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ==================== Send Message ====================
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    // Gated action: anonymous users get the login popup first; their message is
    // replayed automatically once they finish signing in.
    if (!isAuthenticated) {
      requireAuth(() => handleSend());
      return;
    }
    if (!selectedChannel) return;

    // "plan my next 30 days of content" → open the plan wizard on the Calendar page.
    const planMatch = input.match(/\b(content|posting)\s+(plan|calendar|schedule)\b|\bplan\b[^.?!]{0,40}\b(\d+|a|the next|next)?\s*(days?|weeks?|month)\b|\b(fill|build|map out)\b[^.?!]{0,30}\b(calendar|schedule)\b/i);
    if (planMatch && !/carousel/i.test(input)) {
      const n = input.match(/(\d+)\s*(day|week|month)/i);
      const dayCount = n ? Math.min(60, Math.max(1, Number(n[1]) * (/week/i.test(n[2]) ? 7 : /month/i.test(n[2]) ? 30 : 1))) : /month/i.test(input) ? 30 : /week/i.test(input) ? 7 : 30;
      const q = new URLSearchParams({ plan: "1", days: String(dayCount), brand: selectedChannel.brand.id, brief: input.trim().slice(0, 400) });
      setInput("");
      window.location.href = `/calendar?${q.toString()}`;
      return;
    }

    // "make a tiktok slideshow about …" → open the slideshow setup.
    if (/\b(tiktok\s+)?slide\s?show\b/i.test(input) && !/carousel/i.test(input)) {
      setSlideshowAsk(input.trim());
      setInput("");
      return;
    }

    const carouselMatch = input.match(/carousel/i);
    if (carouselMatch) {
      startCarousel(input.trim());
      return;
    }

    const userMessage: StudioMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: "loading", role: "assistant", content: "", createdAt: new Date(), isLoading: true },
    ]);

    try {
      const sg = selectedChannel.brand.styleGuide;

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          platform: selectedPlatform,
          brandId: selectedChannel.brand.id,
          brandName: selectedChannel.brand.name || "My Brand",
          channelDescription: selectedChannel.description || undefined,
          styleGuide: sg ? {
            primaryColor: sg.primaryColor,
            secondaryColor: sg.secondaryColor,
            accentColor: sg.accentColor,
            headingFont: sg.headingFont,
            tone: sg.tone,
            extraNotes: sg.extraNotes,
          } : undefined,
          productImage: attachedImage || undefined,
          imageProvider: imageModel,
        }),
      });

      if (response.status === 402) {
        const d402 = await response.json().catch(() => ({}));
        setMessages((prev) => prev.filter((m) => m.id !== "loading" && m.id !== userMessage.id));
        setInput(userMessage.content);
        openTopUp({ reason: "out_of_credits", neededMilli: d402.neededMilli });
        return;
      }

      const data = await response.json();
      refreshCredits();

      const assistantMessage: StudioMessage = {
        id: Date.now().toString() + "-ai",
        role: "assistant",
        content: data.content || "Sorry, something went wrong.",
        imageUrl: data.imageUrl || null,
        logo: data.logo || null,
        generationId: data.generationId || null,
        createdAt: new Date(),
      };

      setMessages((prev) =>
        prev.filter((m) => m.id !== "loading").concat(assistantMessage)
      );

      if (data.imageUrl) setTiktokSet(null);

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

  const handleGenerateImage = async (prompt: string) => {
    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          size: `${platform.width}x${platform.height}`,
          brandId: selectedChannel?.brand.id,
          productImage: attachedImage || undefined,
          imageProvider: imageModel,
        }),
      });

      if (response.status === 402) {
        const d402 = await response.json().catch(() => ({}));
        openTopUp({ reason: "out_of_credits", neededMilli: d402.neededMilli });
        return;
      }

      const data = await response.json();
      refreshCredits();
      if (data.imageUrl) {
        setTiktokSet(null);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-img",
            role: "assistant",
            content: "Here's the generated image:",
            imageUrl: data.imageUrl,
            logo: data.logo || null,
            generationId: data.generationId || null,
            createdAt: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error("Image generation failed:", err);
    }
  };

  // ==================== Edit an existing image (same image, extra prompt) ====================
  // Sends the current image + the extra instruction to the image endpoint and
  // swaps the result into the same message / slide.
  const handleEditImage = async (
    messageId: string,
    editPrompt: string,
    target: { imageUrl: string; slideIndex?: number }
  ) => {
    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: editPrompt,
          imageUrl: target.imageUrl,
          mode: "edit",
          size: `${platform.width}x${platform.height}`,
          brandId: selectedChannel?.brand.id,
          productImage: attachedImage || undefined,
          imageProvider: imageModel,
        }),
      });
      const data = await response.json();
      if (!data.imageUrl) throw new Error(data.error || "Edit failed");

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          if (target.slideIndex !== undefined && m.carouselSlides) {
            return {
              ...m,
              carouselSlides: m.carouselSlides.map((s, i) =>
                i === target.slideIndex ? { ...s, imageUrl: data.imageUrl } : s
              ),
            };
          }
          return { ...m, imageUrl: data.imageUrl, logo: data.logo ?? m.logo ?? null };
        })
      );
    } catch (err) {
      console.error("Image edit failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-err",
          role: "assistant",
          content: "Couldn't apply that edit. Please try again.",
          createdAt: new Date(),
        },
      ]);
    }
  };

  // ==================== Carousel: read the request, ask only if unclear ====================
  const startCarousel = (message: string) => {
    if (!selectedChannel) return;
    const brandId = selectedChannel.brand.id;
    const parsed = parseCarouselRequest(message);
    const sizeKey = `uxlly.carouselSize.${brandId}`;
    let savedSize: CarouselSize | null = null;
    try { savedSize = (localStorage.getItem(sizeKey) as CarouselSize | null) || null; } catch {}
    const image = attachedImage;

    const questions: ClarifyQuestion[] = [];
    if (!parsed.topicClear) {
      questions.push({ id: "topic", question: "What should the carousel be about?", text: { placeholder: "e.g. 5 ways to price your products for profit", required: true } });
    }
    if (!parsed.size && !savedSize) {
      questions.push({
        id: "size",
        question: "Which size?",
        options: [
          { value: "4:5", label: "Portrait 4:5", description: "Instagram & LinkedIn carousels (recommended)" },
          { value: "1:1", label: "Square 1:1", description: "Instagram & Facebook feed" },
          { value: "9:16", label: "Tall 9:16", description: "TikTok photo carousels & stories" },
        ],
      });
    }
    if (image && parsed.imageTarget === undefined) {
      questions.push({
        id: "image",
        question: "Where should I use the image you attached?",
        options: [
          { value: "intro", label: "On the first slide", description: "The intro / cover" },
          { value: "details", label: "On the detail slides", description: "As the visual on the middle pages" },
          { value: "outro", label: "On the last slide", description: "The closing call to action" },
          { value: "skip", label: "Don't use it", description: "Generate all visuals" },
        ],
        text: { placeholder: "e.g. slide 3" },
      });
    }

    const run = (answers: Record<string, string> = {}) => {
      setClarify(null);
      const size = ((answers.size as CarouselSize) || parsed.size || savedSize || "4:5") as CarouselSize;
      try { localStorage.setItem(sizeKey, size); } catch {}
      const topic = answers.topic ? `${message}: ${answers.topic}` : message;
      let target: SlideImage["target"] | "skip" | undefined = parsed.imageTarget;
      if (answers.image) {
        const n = answers.image.match(/(\d{1,2})/);
        target = n ? parseInt(n[1], 10) : (answers.image as SlideImage["target"] | "skip");
      }
      const slideImages: SlideImage[] = image && target && target !== "skip" ? [{ target, dataUrl: image }] : [];
      if (image) setAttachedImage(null);
      handleGenerateCarousel(topic, parsed.detailCount ? parsed.detailCount + 2 : undefined, undefined, undefined, { size, detailCount: parsed.detailCount, slideImages });
    };

    if (questions.length) setClarify({ questions, onSubmit: run });
    else run();
  };

  const handleGenerateTikTokSlideshow = (params: TikTokSlideshowParams) => {
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
      size?: CarouselSize;
      detailCount?: number;
      slideImages?: SlideImage[];
    }
  ) => {
    if (!selectedChannel) return;
    if (!requireAuth()) return;

    setInput("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: topic, createdAt: new Date() },
      { id: "loading", role: "assistant", content: "", createdAt: new Date(), isLoading: true },
    ]);

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
          referenceImages:
            carouselReferenceImages && carouselReferenceImages.length > 0
              ? carouselReferenceImages
              : undefined,
          format: options?.format ?? "carousel",
          clientName: options?.clientName,
          brandedContent: options?.brandedContent,
          size: options?.size,
          detailCount: options?.detailCount,
          slideImages: options?.slideImages,
        }),
      });

      if (response.status === 402) {
        const d402 = await response.json().catch(() => ({}));
        setMessages((prev) => prev.filter((m) => m.id !== "loading"));
        setInput(topic);
        openTopUp({ reason: "out_of_credits", neededMilli: d402.neededMilli });
        return;
      }

      const data = await response.json();
      refreshCredits();
      if (!data.success) {
        throw new Error(data.error || "Carousel generation failed");
      }

      // Styled carousels render as a background task: run it round by round and show progress.
      if (data.data.background && data.data.taskId) {
        const total: number = data.data.plan?.totalSlides || 0;
        let view: { status: string; progress: number; total: number; slides: CarouselSlideMessage[]; error: string | null } | null = null;
        for (let round = 0; round < 3; round++) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === "loading"
                ? { ...m, content: `Designing your carousel… ${view?.progress ?? 0} of ${total} slides ready`, isLoading: true }
                : m,
            ),
          );
          const stepRes = await fetch(`/api/tasks/${data.data.taskId}/step`, { method: "POST" });
          const stepJson = await stepRes.json().catch(() => null);
          if (!stepJson?.success) throw new Error(stepJson?.error || "Carousel generation failed");
          view = stepJson.data;
          refreshCredits();
          if (view && view.status !== "running") break;
        }
        if (!view || view.status === "failed") throw new Error(view?.error || "Carousel generation failed");
        data.data.slides = view.slides;
        data.data.generationId = (view as { generationId?: string | null }).generationId ?? null;
      }

      const slides: CarouselSlideMessage[] = data.data.slides;
      const successCount = slides.filter((s) => s.imageUrl).length;
      const isTikTok = data.data.format === "tiktok_slideshow";

      setMessages((prev) =>
        prev.filter((m) => m.id !== "loading").concat({
          id: Date.now().toString() + "-carousel",
          role: "assistant",
          content: `Here's your ${slides.length}-slide ${isTikTok ? "TikTok slideshow" : "carousel"}${
            successCount < slides.length ? ` (${successCount}/${slides.length} slides generated)` : ""
          }:`,
          // TikTok slideshows open in the movable-box editor below instead
          carouselSlides: isTikTok ? undefined : slides,
          generationId: isTikTok ? null : data.data.generationId ?? null,
          createdAt: new Date(),
        })
      );

      setTiktokSet(isTikTok ? { slides, disclosure: data.data.disclosure ?? null } : null);
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

  // ==================== Auto-start from the TikTok setup wizard ====================
  const tiktokAutoRan = useRef(false);
  useEffect(() => {
    if (tiktokAutoRan.current) return;
    if (searchParams.get("tiktok") !== "1") return;
    if (!selectedChannel) return;

    let setup: TikTokSetup | null = null;
    try {
      const raw = sessionStorage.getItem(TIKTOK_SETUP_KEY);
      if (raw) setup = JSON.parse(raw) as TikTokSetup;
    } catch {
      setup = null;
    }
    if (!setup) return;

    tiktokAutoRan.current = true;
    try { sessionStorage.removeItem(TIKTOK_SETUP_KEY); } catch {}

    const projectRefs = (selectedChannel.brand.styleGuide?.referenceImages as string[] | null) || [];
    const mergedRefs = [...(setup.referenceImages || []), ...projectRefs];

    handleGenerateCarousel(
      setup.topic,
      setup.slideCount === "auto" ? undefined : setup.slideCount,
      TIKTOK_CTA_TEXT[setup.ctaGoal],
      mergedRefs.length > 0 ? mergedRefs : undefined,
      { platform: "tiktok", format: "tiktok_slideshow", brandedContent: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel, searchParams]);

  // ==================== The Prompt Box ====================
  const promptBox = (
    <div className="w-full relative z-10">
      <ProjectPrompt
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        disabled={isAuthenticated && !selectedChannel}
        attachedImage={attachedImage}
        onAttachImage={setAttachedImage}
        imageModel={imageModel}
        onImageModelChange={setImageModel}
      />
    </div>
  );

  const isStarted = messages.length > 0 || !!tiktokSet;

  // Files tab: every generated image across the conversation
  const fileUrls: string[] = [
    ...messages.flatMap((m) =>
      m.carouselSlides
        ? m.carouselSlides.map((s) => s.imageUrl).filter((u): u is string => !!u)
        : m.imageUrl ? [m.imageUrl] : []
    ),
    ...(tiktokSet ? tiktokSet.slides.map((s) => s.imageUrl).filter((u): u is string => !!u) : []),
  ];

  return (
    <div className="flex h-full w-full bg-[#FAFAFA] overflow-hidden font-sans flex-col">
      {slideshowAsk !== null && selectedChannel && (
        <SlideshowWizard
          brandId={selectedChannel.brand.id}
          initialTopic={slideshowAsk.replace(/^(please\s+)?(can you\s+)?(make|create|generate|build)\s+(me\s+)?(a|an)?\s*(tiktok\s+)?slide\s?show\s*(about|on|for|of)?\s*/i, "").trim()}
          onClose={() => setSlideshowAsk(null)}
          onInsufficient={(neededMilli) => openTopUp({ reason: "out_of_credits", neededMilli })}
          onDone={(r: SlideshowResult) => {
            setSlideshowAsk(null);
            refreshCredits();
            const ok = r.slides.filter((s) => s.imageUrl).length;
            setMessages((prev) =>
              prev.concat(
                { id: Date.now().toString(), role: "user", content: slideshowAsk || "TikTok slideshow", createdAt: new Date() },
                { id: Date.now().toString() + "-slideshow", role: "assistant", content: `Here's your ${r.slides.length}-slide TikTok slideshow "${r.title}"${ok < r.slides.length ? ` (${ok}/${r.slides.length} photos made)` : ""}. Tap Edit slide to change the text, move it or pick a caption box. It's saved to your Files.`, createdAt: new Date() },
              ),
            );
            setTiktokSet({ slides: r.slides, disclosure: null });
          }}
        />
      )}
      {clarify && <ClarifyModal questions={clarify.questions} onSubmit={clarify.onSubmit} onCancel={() => setClarify(null)} />}

      <header className="h-11 flex items-center px-6 border-b border-gray-200/50 bg-white shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowProjectPicker(!showProjectPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors max-w-[220px]"
            >
              <FolderKanban size={12} className="text-gray-400 shrink-0" />
              <span className="truncate">
                {selectedChannel ? selectedChannel.name : "Select project"}
              </span>
              <ChevronDown size={12} className="text-gray-400 shrink-0" />
            </button>

            {showProjectPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50 w-80 max-h-96 overflow-y-auto">
                {channels.length === 0 && (
                  <p className="text-xs text-gray-400 px-3 py-2">No projects yet.</p>
                )}
                {channels.map((ch) => (
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
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-full flex items-center justify-between">
                      <div className="text-left">
                        <p className="font-medium">{ch.name}</p>
                        <p className="text-gray-400">{ch.brand.name}</p>
                      </div>
                      <Badge variant="neutral">{ch.platform}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* MIDDLE CHAT */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {messages.length > 0 && selectedChannel && (
            <button
              type="button"
              onClick={() => {
                const id = selectedChannel.brand.id;
                setMessages([]);
                setTiktokSet(null);
                fetch(`/api/chat-session?brandId=${id}`, { method: "DELETE" }).catch(() => {});
              }}
              className="absolute top-3 right-4 z-10 rounded-full border border-[#E7E7EA] bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:text-zinc-900 shadow-sm"
            >
              New chat
            </button>
          )}
          <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col items-center p-4">
            {!isStarted ? (
              <div className="w-full max-w-2xl flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 mb-6 opacity-60">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-gray-300 fill-current blur-[1px]">
                    <path d="M50 0 C50 30 70 50 100 50 C70 50 50 70 50 100 C50 70 30 50 0 50 C30 50 50 30 50 0 Z" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back!</h1>
                <p className="text-gray-500">How can I help you today?</p>
              </div>
            ) : (
              <div className="w-full max-w-2xl flex flex-col gap-7 py-4">
                {messages.map((msg) => {
                  // ---- user: soft gray bubble, right ----
                  if (msg.role === "user") {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl rounded-br-none bg-[#EFEFEF] px-5 py-3.5 text-[15px] leading-relaxed text-zinc-900 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }
                  // ---- assistant loading ----
                  if (msg.isLoading) {
                    return (
                      <div key={msg.id} className="flex items-center gap-2 text-[15px] text-zinc-500 px-1">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        {msg.content || "Thinking..."}
                      </div>
                    );
                  }
                  // ---- assistant with media: card + action bar ----
                  if (msg.imageUrl || (msg.carouselSlides && msg.carouselSlides.length > 0)) {
                    return (
                      <ChatMediaCard
                        key={msg.id}
                        text={msg.content}
                        imageUrl={msg.imageUrl}
                        slides={msg.carouselSlides}
                        logo={msg.logo}
                        aspect={aspect}
                        generationId={msg.generationId}
                        onSlideRedone={(i, url) =>
                          setMessages((prev) =>
                            prev.map((m) => (m.id === msg.id ? { ...m, carouselSlides: (m.carouselSlides || []).map((sl, k) => (k === i ? { ...sl, imageUrl: url } : sl)) } : m)),
                          )
                        }
                        onEdit={(p, t) => handleEditImage(msg.id, p, t)}
                      />
                    );
                  }
                  // ---- assistant text: plain, no bubble ----
                  return (
                    <p key={msg.id} className="text-[15px] leading-relaxed text-zinc-900 whitespace-pre-wrap px-1">
                      {msg.content}
                    </p>
                  );
                })}

                {tiktokSet && tiktokSet.slides.length > 0 && (
                  <div className="w-full max-w-md">
                    <TikTokSlideEditor slides={tiktokSet.slides} disclosure={tiktokSet.disclosure} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt box — always docked at the bottom */}
          <div className="px-4 pb-6 pt-0 bg-[#FAFAFA] shrink-0">
            <div className="w-full max-w-2xl mx-auto">
              {promptBox}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-[380px] shrink-0 bg-white border-l border-gray-200 flex flex-col h-full shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-20">
          <div className="p-4 border-b border-gray-100">
            <div className="flex bg-[#F5F5F7] p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setActiveRightTab("settings")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeRightTab === "settings" ? "bg-white text-gray-900 shadow-sm border border-gray-200/50" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveRightTab("files")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeRightTab === "files" ? "bg-white text-gray-900 shadow-sm border border-gray-200/50" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Files
              </button>
            </div>
          </div>

          {activeRightTab === "settings" ? (
            <div className="flex-1 min-h-0">
              <ProjectSettings brandId={selectedChannel?.brand?.id ?? null} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {fileUrls.map((url, i) => (
                  <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="generated" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <a
                        href={url}
                        download={`uxlly-${i + 1}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-900 shadow-lg hover:bg-white transition-colors"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
                {fileUrls.length === 0 && (
                  <div className="col-span-2 text-center py-10 text-sm text-gray-400">
                    No files generated yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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