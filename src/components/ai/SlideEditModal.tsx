// ============================================================
// UXLLY — Slide Edit Popup
// Opened from the Edit button on any slide. The slide image sits on
// the left with a box around each text block and the logo; drag a box
// to move it, drag a corner to resize it. The editor on the right
// holds the element list, text settings and the text itself.
// ============================================================

"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import type { CarouselSlideMessage } from "@/types";
import {
  OVERLAY_FONTS,
  KIND_LABEL,
  DEFAULT_TEXT_STYLE,
  buildTexts,
  clampBox,
  defaultStyleFor,
  defaultTextBoxes,
  drawSlideLayout,
  newId,
  type Box,
  type SlideLayout,
  type TextAlign,
  type TextElement,
  type TextKind,
  type TextStyle,
} from "@/lib/overlay/elements";
import { loadImage } from "@/lib/overlay/slideText";

const LOGO_ID = "logo";
const MIN_SIZE = 0.05;

type Handle = "move" | "nw" | "ne" | "sw" | "se";

// Builds the editable layout from a generated slide (headline, body and logo boxes from the planner).
export function layoutFromSlide(slide: CarouselSlideMessage): SlideLayout {
  const fallback = defaultTextBoxes(slide.role);
  const look = slide.captionStyle;
  const texts = buildTexts(
      slide.headline,
      slide.body,
      {
        headline: clampBox(slide.headlineBox, fallback.headline),
        body: clampBox(slide.bodyBox, fallback.body),
      },
      { headline: slide.headlineAlign, body: slide.bodyAlign }
    );
  // Lifestyle slideshows: caption box look, and a full-size second caption for 2-in-1 slides.
  if (slide.bodyKind === "h1" && texts[1]) {
    texts[1].kind = "h1";
    texts[1].style = { ...defaultStyleFor("h1"), align: texts[1].style.align };
  }
  if (look) {
    for (const t of texts) {
      t.style = { ...t.style, bg: look === "plain" ? "none" : look, color: look === "white" ? "#111111" : "#FFFFFF" };
    }
  }
  return {
    texts,
    logo: slide.logo ? { src: slide.logo.src, box: clampBox(slide.logo.box, { x: 0.8, y: 0.8, w: 0.14, h: 0.14 }) } : null,
  };
}

// Moves or resizes a box by a fractional delta. Corners move two edges; "move" shifts the whole box.
function applyHandle(start: Box, handle: Handle, dx: number, dy: number): Box {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  if (handle === "move") {
    return {
      x: clamp(start.x + dx, 0, 1 - start.w),
      y: clamp(start.y + dy, 0, 1 - start.h),
      w: start.w,
      h: start.h,
    };
  }
  let x1 = start.x;
  let y1 = start.y;
  let x2 = start.x + start.w;
  let y2 = start.y + start.h;
  if (handle.includes("w")) x1 = clamp(start.x + dx, 0, x2 - MIN_SIZE);
  if (handle.includes("e")) x2 = clamp(start.x + start.w + dx, x1 + MIN_SIZE, 1);
  if (handle.includes("n")) y1 = clamp(start.y + dy, 0, y2 - MIN_SIZE);
  if (handle.includes("s")) y2 = clamp(start.y + start.h + dy, y1 + MIN_SIZE, 1);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

const HANDLE_POSITION: Record<Exclude<Handle, "move">, string> = {
  nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
  ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
  sw: "-left-1.5 -bottom-1.5 cursor-nesw-resize",
  se: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
};

interface SlideEditModalProps {
  slide: CarouselSlideMessage;
  setLabel: string; // "Carousel" or "TikTok" — shown in the editor header
  initialLayout: SlideLayout;
  onSave: (layout: SlideLayout) => void;
  onClose: () => void;
}

export default function SlideEditModal({ slide, setLabel, initialLayout, onSave, onClose }: SlideEditModalProps) {
  const [layout, setLayout] = useState<SlideLayout>(initialLayout);
  const [selectedId, setSelectedId] = useState<string | null>(initialLayout.texts[0]?.id ?? (initialLayout.logo ? LOGO_ID : null));
  const [selectedCopy, setSelectedCopy] = useState("");
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; handle: Handle; startX: number; startY: number; start: Box } | null>(null);

  // Load the background once for this slide.
  useEffect(() => {
    let cancelled = false;
    setBg(null);
    setError(null);
    loadImage(slide.imageUrl)
      .then((img) => {
        if (!cancelled) setBg(img);
      })
      .catch(() => {
        if (!cancelled) setError("This image couldn't load for editing. Try regenerating the slide.");
      });
    return () => {
      cancelled = true;
    };
  }, [slide.imageUrl]);

  // Redraw the preview whenever the layout changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!bg || !canvas) return;
    drawSlideLayout(canvas, bg, layout).catch(() => setError("The preview couldn't be drawn."));
  }, [bg, layout]);

  // Escape closes the popup without saving.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedText = layout.texts.find((t) => t.id === selectedId) ?? null;
  const selectedIsLogo = selectedId === LOGO_ID && !!layout.logo;

  const boxOf = (id: string): Box | null =>
    id === LOGO_ID ? layout.logo?.box ?? null : layout.texts.find((t) => t.id === id)?.box ?? null;

  const setBoxOf = (id: string, box: Box) =>
    setLayout((prev) =>
      id === LOGO_ID
        ? prev.logo
          ? { ...prev, logo: { ...prev.logo, box } }
          : prev
        : { ...prev, texts: prev.texts.map((t) => (t.id === id ? { ...t, box } : t)) }
    );

  const beginDrag = (e: ReactPointerEvent<HTMLElement>, id: string, handle: Handle) => {
    const start = boxOf(id);
    if (!start) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, handle, startX: e.clientX, startY: e.clientY, start };
  };

  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const overlay = overlayRef.current;
    if (!drag || !overlay) return;
    const rect = overlay.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    setBoxOf(drag.id, applyHandle(drag.start, drag.handle, dx, dy));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const updateSelectedText = (patch: Partial<TextElement>) => {
    if (!selectedText) return;
    setLayout((prev) => ({
      ...prev,
      texts: prev.texts.map((t) => (t.id === selectedText.id ? { ...t, ...patch } : t)),
    }));
  };

  const updateSelectedStyle = (patch: Partial<TextStyle>) => {
    if (!selectedText) return;
    updateSelectedText({ style: { ...selectedText.style, ...patch } });
  };

  const addText = (kind: TextKind) => {
    const id = newId(kind);
    const base = selectedText?.style ?? DEFAULT_TEXT_STYLE;
    const box: Box =
      kind === "h1"
        ? { x: 0.08, y: 0.1, w: 0.84, h: 0.22 }
        : kind === "h2"
          ? { x: 0.08, y: 0.4, w: 0.84, h: 0.12 }
          : { x: 0.08, y: 0.55, w: 0.84, h: 0.25 };
    const sample = kind === "bullet" ? "First point\nSecond point" : kind === "p" ? "Your paragraph" : "Your heading";
    const el: TextElement = { id, kind, text: sample, box, style: defaultStyleFor(kind, base) };
    setLayout((prev) => ({ ...prev, texts: [...prev.texts, el] }));
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (selectedIsLogo) {
      setLayout((prev) => ({ ...prev, logo: null }));
      setSelectedId(layout.texts[0]?.id ?? null);
      return;
    }
    if (!selectedText) return;
    setLayout((prev) => ({ ...prev, texts: prev.texts.filter((t) => t.id !== selectedText.id) }));
    setSelectedId(layout.texts.find((t) => t.id !== selectedText.id)?.id ?? null);
  };

  const copySelection = async () => {
    try {
      await navigator.clipboard.writeText(selectedCopy);
    } catch {
      setError("Couldn't copy to the clipboard.");
    }
  };

  const copyWholeText = async () => {
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText.text);
    } catch {
      setError("Couldn't copy to the clipboard.");
    }
  };

  const shortId = (id: string) => id.split("-").slice(-1)[0];
  const headerKind = selectedIsLogo ? "Logo" : selectedText ? KIND_LABEL[selectedText.kind] : "—";
  const headerId = selectedIsLogo ? "logo" : selectedText ? shortId(selectedText.id) : "";

  const alignments: { value: TextAlign; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
  ];

  const renderBox = (id: string, box: Box, tag: string) => {
    const selected = selectedId === id;
    return (
      <div
        key={id}
        onPointerDown={(e) => beginDrag(e, id, "move")}
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
        }}
        className={`absolute pointer-events-auto cursor-move touch-none ${
          selected ? "border-2 border-brand-500" : "border border-dashed border-white/80"
        }`}
      >
        <span
          className={`absolute -top-5 left-0 px-1 rounded text-[10px] font-semibold text-white whitespace-nowrap ${
            selected ? "bg-brand-500" : "bg-ink-500/80"
          }`}
        >
          {tag}
        </span>
        {selected &&
          (["nw", "ne", "sw", "se"] as const).map((hd) => (
            <span
              key={hd}
              onPointerDown={(e) => beginDrag(e, id, hd)}
              className={`absolute w-3 h-3 bg-white border-2 border-brand-500 rounded-sm ${HANDLE_POSITION[hd]}`}
            />
          ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-6xl max-h-[92vh] bg-white rounded-xl shadow-modal overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* ==================== Left: slide with element boxes ==================== */}
        <div className="bg-surface-100 flex items-center justify-center p-4 overflow-auto min-h-[320px]">
          {error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : (
            <div className="relative inline-block select-none">
              <canvas ref={canvasRef} className="block rounded-lg shadow-card max-h-[76vh] w-auto max-w-full" />
              <div
                ref={overlayRef}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="absolute inset-0 pointer-events-none"
                onPointerDown={(e) => {
                  // Clicking empty space deselects.
                  if (e.target === e.currentTarget) setSelectedId(null);
                }}
              >
                {layout.texts.map((t) =>
                  renderBox(t.id, t.box, `${KIND_LABEL[t.kind]}`)
                )}
                {layout.logo && renderBox(LOGO_ID, layout.logo.box, "Logo")}
              </div>
            </div>
          )}
        </div>

        {/* ==================== Right: editor ==================== */}
        <div className="flex flex-col min-h-0 border-l border-surface-200 overflow-y-auto">
          {/* Header: which element is selected */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-surface-200">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900 truncate">
                {setLabel} {slide.slideNumber} · {headerKind}
                {headerId && <span className="text-ink-400 font-normal"> · {headerId}</span>}
              </p>
              <p className="text-xs text-ink-400">Drag a box to move it, drag a corner to resize.</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-ink-400" aria-label="Close editor">
              <X size={16} />
            </button>
          </div>

          {/* Element list */}
          <div className="px-4 py-3 border-b border-surface-200 space-y-2">
            <p className="text-xs font-semibold text-ink-700">Elements</p>
            <div className="flex flex-col gap-1">
              {layout.texts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`text-left px-2 py-1.5 rounded-lg border text-xs truncate ${
                    selectedId === t.id ? "border-brand-500 bg-brand-50 text-brand-600" : "border-surface-200 text-ink-600 hover:bg-surface-50"
                  }`}
                >
                  <span className="font-semibold">{KIND_LABEL[t.kind]}</span>
                  <span className="text-ink-400"> · {t.text.split("\n")[0].slice(0, 36) || "empty"}</span>
                </button>
              ))}
              {layout.logo && (
                <button
                  onClick={() => setSelectedId(LOGO_ID)}
                  className={`text-left px-2 py-1.5 rounded-lg border text-xs ${
                    selectedId === LOGO_ID ? "border-brand-500 bg-brand-50 text-brand-600" : "border-surface-200 text-ink-600 hover:bg-surface-50"
                  }`}
                >
                  <span className="font-semibold">Logo</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["h1", "h2", "p", "bullet"] as TextKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => addText(k)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-surface-200 text-xs text-ink-600 hover:bg-surface-50"
                >
                  <Plus size={12} /> {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Text settings */}
          {selectedText ? (
            <div className="px-4 py-3 border-b border-surface-200 space-y-3">
              <p className="text-xs font-semibold text-ink-700">Text settings</p>

              <div>
                <label className="text-xs text-ink-600 mb-1 block">Font</label>
                <select
                  value={selectedText.style.fontFamily}
                  onChange={(e) => updateSelectedStyle({ fontFamily: e.target.value })}
                  className="uxlly-input text-xs w-full"
                >
                  {OVERLAY_FONTS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-600 mb-1 block">Size ({selectedText.style.sizePct.toFixed(1)}%)</label>
                  <input
                    type="range"
                    min={3}
                    max={14}
                    step={0.5}
                    value={selectedText.style.sizePct}
                    onChange={(e) => updateSelectedStyle({ sizePct: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-600 mb-1 block">Spacing ({selectedText.style.lineSpacing.toFixed(2)})</label>
                  <input
                    type="range"
                    min={0.9}
                    max={2}
                    step={0.05}
                    value={selectedText.style.lineSpacing}
                    onChange={(e) => updateSelectedStyle({ lineSpacing: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-ink-600 flex items-center gap-2">
                  Colour
                  <input
                    type="color"
                    value={selectedText.style.color}
                    onChange={(e) => updateSelectedStyle({ color: e.target.value })}
                    className="w-8 h-8 rounded border border-surface-200 bg-transparent"
                  />
                </label>
              </div>

              <div>
                <label className="text-xs text-ink-600 mb-1 block">Caption box</label>
                <div className="flex gap-1.5">
                  {(
                    [
                      { v: "none", label: "None", color: null },
                      { v: "white", label: "White", color: "#111111" },
                      { v: "dark", label: "Dark", color: "#FFFFFF" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      onClick={() => updateSelectedStyle(o.color ? { bg: o.v, color: o.color } : { bg: "none" })}
                      className={`flex-1 px-2 py-1.5 rounded-lg border text-xs ${
                        (selectedText.style.bg || "none") === o.v
                          ? "border-brand-500 bg-brand-50 text-brand-600"
                          : "border-surface-200 text-ink-600 hover:bg-surface-50"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5">
                {(
                  [
                    { key: "bold", label: "B", cls: "font-bold" },
                    { key: "italic", label: "I", cls: "italic" },
                    { key: "underline", label: "U", cls: "underline" },
                    { key: "strike", label: "S", cls: "line-through" },
                  ] as const
                ).map((f) => {
                  const on = selectedText.style[f.key];
                  return (
                    <button
                      key={f.key}
                      onClick={() => updateSelectedStyle({ [f.key]: !on } as Partial<TextStyle>)}
                      className={`w-9 h-9 rounded-lg border text-sm ${f.cls} ${
                        on ? "border-brand-500 bg-brand-50 text-brand-600" : "border-surface-200 text-ink-600 hover:bg-surface-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-1.5">
                {alignments.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => updateSelectedStyle({ align: a.value })}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-xs ${
                      selectedText.style.align === a.value
                        ? "border-brand-500 bg-brand-50 text-brand-600"
                        : "border-surface-200 text-ink-600 hover:bg-surface-50"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <button onClick={deleteSelected} className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline">
                <Trash2 size={12} /> Delete this text
              </button>
            </div>
          ) : selectedIsLogo ? (
            <div className="px-4 py-3 border-b border-surface-200 space-y-2">
              <p className="text-xs font-semibold text-ink-700">Logo</p>
              <p className="text-xs text-ink-500">Drag the logo box to move it, or drag a corner to resize.</p>
              <button onClick={deleteSelected} className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline">
                <Trash2 size={12} /> Remove logo from this slide
              </button>
            </div>
          ) : null}

          {/* Text box at the bottom: change the selected element's copy */}
          <div className="px-4 py-3 mt-auto space-y-2">
            {selectedText && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink-700">Text</label>
                  <button onClick={copyWholeText} className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800">
                    <Copy size={12} /> Copy all
                  </button>
                </div>
                <textarea
                  value={selectedText.text}
                  onChange={(e) => updateSelectedText({ text: e.target.value })}
                  onSelect={(e) => {
                    const ta = e.currentTarget;
                    setSelectedCopy(ta.value.slice(ta.selectionStart, ta.selectionEnd));
                  }}
                  rows={5}
                  className="uxlly-input text-sm w-full"
                />
                {selectedCopy.trim() && (
                  <button
                    onClick={copySelection}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-surface-200 bg-white shadow-sm text-xs text-ink-700 hover:bg-surface-50"
                  >
                    <Copy size={12} /> Copy selection
                  </button>
                )}
                {selectedText.kind === "bullet" && (
                  <p className="text-[11px] text-ink-400">One point per line. Each line becomes a bullet.</p>
                )}
              </>
            )}
            {!selectedText && !selectedIsLogo && (
              <p className="text-xs text-ink-400">Select an element to edit its text.</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-surface-200">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => { onSave(layout); onClose(); }} disabled={!bg}>
              Save slide
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
