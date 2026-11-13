// ============================================================
// UXLLY — Free Chat (/chat)
// A brandless, conversational image studio. Starts as a hero with
// quick-template tiles + the "Discover and remix ideas" gallery;
// the moment the user sends, the hero/tiles/gallery collapse and it
// becomes a chat (like the AI Studio), inline.
//  - No project/brand required — pure prompt-to-image.
//  - The "+" (or a template tile) adds a reference image to steer it.
//  - Sending is gated: anonymous users get the login popup, then the
//    message is replayed (see AuthGate / updates_5).
// ============================================================

"use client";

import "@/app/home/home.css"; // for the "Discover and remix ideas" gallery styles

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { ProjectPrompt } from "@/components/projects/ProjectPrompt";
import { useAuthGate } from "@/components/auth/AuthGate";
import { GallerySection } from "@/app/home/components/GallerySection";
import { extractImagePrompt } from "@/lib/utils";
import { useBilling } from "@/components/billing/BillingProvider";
import { Sparkles, Download, Loader2, Plus } from "lucide-react";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
  ref?: string | null; // the photo attached to a user message
  isLoading?: boolean;
}

interface TemplateRef {
  id: string;
  name: string;
  publicUrl: string;
}

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

// Fetch any image URL and return it as a data URL, so it can be sent to the
// generator as a reference (the server needs the bytes, not a relative path).
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Hero animation: the brand word sits in a dark chip whose width morphs
// between words while the text crossfades. No layout jump, no per-letter re-renders.
const TYPED_WORDS = ["coffee brand", "SaaS", "product", "Instagram page", "Facebook page"];
const CHIP_EASE = "cubic-bezier(.65,0,.35,1)";
const CHIP_PAD = "0.28em";

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

function TypedBrand({ interval = 2400 }: { interval?: number }) {
  const [n, setN] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);
  const measureRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  // Measure each word at the real font size (re-measure after fonts load and
  // on resize, since the h1 switches 32px → 40px at md).
  useLayoutEffect(() => {
    const measure = () => {
      const el = measureRef.current;
      if (el) setWidths(Array.from(el.children).map((c) => Math.ceil((c as HTMLElement).getBoundingClientRect().width)));
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const id = setInterval(() => !document.hidden && setN((x) => x + 1), interval);
    return () => clearInterval(id);
  }, [interval]);

  const i = n % TYPED_WORDS.length;
  const prev = n > 0 ? (n - 1) % TYPED_WORDS.length : null;
  const animate = prev !== null && !reduce;
  const w = widths[i];

  return (
    <span
      className="relative inline-block overflow-hidden whitespace-nowrap text-left bg-zinc-900 text-white rounded-[0.3em]"
      style={{
        height: "1.25em",
        lineHeight: "1.25em",
        padding: `0 ${CHIP_PAD}`,
        // Tailwind preflight is border-box, so the padding is included in the width.
        width: w ? `calc(${w}px + ${CHIP_PAD} * 2)` : "auto",
        transition: reduce ? undefined : `width 520ms ${CHIP_EASE}`,
      }}
    >
      <span className="sr-only">your brand</span>
      {animate && (
        <span key={`o${n}`} aria-hidden className="absolute top-0" style={{ left: CHIP_PAD, animation: "tb-chip-out 260ms ease-out both" }}>
          {TYPED_WORDS[prev!]}
        </span>
      )}
      <span key={`i${n}`} aria-hidden className="inline-block" style={{ animation: animate ? `tb-chip-in 420ms ${CHIP_EASE} 120ms both` : undefined }}>
        {TYPED_WORDS[i]}
      </span>
      <span ref={measureRef} aria-hidden className="invisible absolute left-0 top-0">
        {TYPED_WORDS.map((word) => (
          <span key={word} className="absolute whitespace-nowrap">{word}</span>
        ))}
      </span>
      <style>{`
        @keyframes tb-chip-in { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: none } }
        @keyframes tb-chip-out { from { opacity: 1 } to { opacity: 0; transform: scale(1.04) } }
      `}</style>
    </span>
  );
}

export default function FreeChatPage() {
  const { requireAuth, isAuthenticated } = useAuthGate();
  const { openTopUp, refresh: refreshCredits } = useBilling();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [imageModel, setImageModel] = useState<string>("openai");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateRef[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false); // hard guard: one send at a time

  const started = messages.length > 0;

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.templates)) setTemplates(d.templates.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function pickTemplate(t: TemplateRef) {
    try {
      setAttachedImage(await urlToDataUrl(t.publicUrl));
    } catch {
      /* ignore */
    }
  }

  function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  const handleSend = async (override?: { text: string; ref?: string | null }) => {
    if (!(override?.text ?? input).trim() || loading || sendingRef.current) return;
    // Visitors can chat freely; login is asked for when they download (or hit the visitor limit).
    sendingRef.current = true;

    const userText = (override?.text ?? input).trim();
    const ref = override ? override.ref ?? null : attachedImage;
    const userMsg: ChatMsg = { id: Date.now() + "-u", role: "user", content: userText, ref };
    setMessages((p) => [...p, userMsg, { id: "loading", role: "assistant", content: "", isLoading: true }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          platform: "instagram_post",
          brandName: "Free Chat",
          freeChat: true,
          productImage: ref || undefined,
          imageProvider: imageModel,
        }),
      });
      if (res.status === 429 || (res.status === 401 && !isAuthenticated)) {
        setMessages((p) => p.filter((m) => m.id !== "loading" && m.id !== userMsg.id));
        setInput(userText);
        requireAuth(() => handleSend(override));
        return;
      }
      if (res.status === 402) {
        // Out of credits: undo this send, put the text back, open the top-up popup.
        const d402 = await res.json().catch(() => ({}));
        setMessages((p) => p.filter((m) => m.id !== "loading" && m.id !== userMsg.id));
        setInput(userText);
        openTopUp({ reason: "out_of_credits", neededMilli: d402.neededMilli });
        return;
      }

      const data = await res.json();
      refreshCredits();

      let imageUrl: string | null = data.imageUrl || null;
      const prompt = extractImagePrompt(data.content || "");
      if (!imageUrl && prompt) {
        try {
          const imgRes = await fetch("/api/ai/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, size: "1080x1080", productImage: ref || undefined, imageProvider: imageModel }),
          });
          const imgData = await imgRes.json();
          imageUrl = imgData.imageUrl || null;
        } catch {
          /* ignore */
        }
      }

      setMessages((p) =>
        p.filter((m) => m.id !== "loading").concat({
          id: Date.now() + "-a",
          role: "assistant",
          content: data.content || "Here's what I made.",
          imageUrl,
        })
      );
    } catch {
      setMessages((p) =>
        p.filter((m) => m.id !== "loading").concat({
          id: Date.now() + "-err",
          role: "assistant",
          content: "Something went wrong. Please try again.",
        })
      );
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  // Single composer instance reused by both the landing and the chat view.
  const composer = (
    <ProjectPrompt
      value={input}
      onChange={setInput}
      onSubmit={() => handleSend()}
      attachedImage={attachedImage}
      onAttachImage={setAttachedImage}
      imageModel={imageModel}
      onImageModelChange={setImageModel}
    />
  );

  const hiddenUpload = (
    <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadChange} className="hidden" />
  );

  // ======================= Landing (not chatting) =======================
  if (!started) {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[#FFFFFF]">
        {hiddenUpload}
        <main className="flex flex-col items-center justify-center px-4 pt-14 min-h-[calc(100%-40px)]">
<Sparkles className="text-[#7C3AED] mb-4" size={40} strokeWidth={1.3} />
          <h1
            aria-label="Make an ad for your brand"
            className="text-[32px] md:text-[40px] font-bold text-gray-900 tracking-[-0.02em] text-center flex flex-wrap items-center justify-center gap-x-[0.3em] gap-y-2"
          >
            <span>Make an ad for my</span>
            <TypedBrand />
          </h1>
          <p className="mt-3 mb-4 text-sm text-gray-500 text-center">
            Create high-quality social media posts. Describe anything, or add a reference with +.
          </p>

          {/* Quick templates — width matches the chat input below */}
          <div className="w-full max-w-3xl mt-9 grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              className="aspect-square rounded-xl bg-white flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors border-2 border-dashed border-gray-300"
            >
              <Plus size={22} className="text-gray-400 mb-1" />
              <span className="text-[10px] font-medium text-gray-600">Add reference</span>
            </button>

            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t)}
                className="aspect-square rounded-xl overflow-hidden relative cursor-pointer border border-gray-200 group p-[25px] bg-[#B5B6B8]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.publicUrl} alt={t.name} className="w-full h-full object-contain mb-[10px] rounded-[10px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                <span className="absolute bottom-2 left-3 right-3 text-[10px] font-semibold text-white truncate">{t.name}</span>
                <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/30 text-white text-[11px] font-semibold">
                  Use as reference
                </span>
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="w-full max-w-4xl mt-10">{composer}</div>
        </main>

        {/* Discover and remix ideas — only shows on the landing, hidden while chatting */}
        <div className="w-full max-w-5xl mx-auto px-4 pb-16">
          <GallerySection />
        </div>
      </div>
    );
  }

  // ======================= Chat (after first send) =======================
  return (
    <div className="flex flex-col h-full bg-[#FFFFFF]">
      {hiddenUpload}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-6 flex flex-col gap-5">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="bg-[#EDEDEF] text-zinc-900 rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] max-w-[80%]">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-b from-zinc-700 to-zinc-900 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles size={13} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  {m.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 mt-1.5">
                      <Loader2 size={15} className="animate-spin" /> Creating…
                    </div>
                  ) : (
                    <>
                      {m.content && <p className="text-[15px] leading-relaxed text-zinc-900 mb-2">{m.content}</p>}
                      {m.imageUrl && (
                        <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-sm p-2 max-w-[460px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.imageUrl} alt="Generated" className="w-full rounded-xl" />
                          <div className="flex justify-end gap-1 mt-1.5">
                            {(() => {
                              const at = messages.findIndex((x) => x.id === m.id);
                              const prevUser = [...messages.slice(0, Math.max(0, at))].reverse().find((x) => x.role === "user");
                              if (!prevUser || !/\b(thumbnails?|thumbs?)\b/i.test(prevUser.content) || loading) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleSend({ text: `${prevUser.content.replace(/\s*\n*Make a completely different version[^]*$/i, "")}\n\nMake a completely different version: new composition, new pose and expression.`, ref: prevUser.ref })}
                                  className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium text-zinc-700 hover:bg-[#F4F4F5]"
                                >
                                  <Sparkles size={14} /> Redo thumbnail
                                </button>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => (isAuthenticated ? download(m.imageUrl!, "uxlly-free.png") : requireAuth(() => download(m.imageUrl!, "uxlly-free.png")))}
                              className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium text-zinc-700 hover:bg-[#F4F4F5]"
                            >
                              <Download size={14} /> Download
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="w-full px-4 pb-6">
        <div className="max-w-3xl mx-auto">{composer}</div>
      </div>
    </div>
  );
}
