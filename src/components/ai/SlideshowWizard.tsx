// ============================================================
// UXLLY — TikTok lifestyle slideshow: setup + generation
// Topic & format → character & style → slides, shape & video frames → make.
// One text call plans every slide; each photo is its own short request, so
// nothing times out. Photos come back without words: text is added in the
// slide editor. Video frames fill photo slots for free.
// ============================================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Film, Loader2, Plus, UserRound, X } from "lucide-react";
import type { CarouselSlideMessage } from "@/types";
import WizardShell from "@/components/ui/WizardShell";
import LModal from "@/components/ui/LModal";
import { Field, LButton, LTextarea } from "@/components/ui/light";
import CharacterWizard from "@/components/ai/CharacterWizard";
import SlideshowStyleWizard from "@/components/ai/SlideshowStyleWizard";
import VideoFramePicker from "@/components/ai/VideoFramePicker";
import { stackImages, uploadData } from "@/lib/slideshow/frames";
import { ASPECT_PX, FORMATS, HALF_PX, type CaptionLook, type Character, type PlannedSlide, type SlideshowAspect, type SlideshowFormat } from "@/lib/slideshow/types";

export interface SlideshowResult {
  title: string;
  slides: CarouselSlideMessage[];
  generationId: string | null;
  format: SlideshowFormat;
}

interface StyleCard {
  id: string;
  name: string;
  description: string;
  textStyle: CaptionLook;
  formats: string[];
  mine: boolean;
  cover: string | null;
}

const STEPS = [
  { id: "topic", title: "What's the slideshow about?", sub: "Any topic: travel, money, habits, a day in your life." },
  { id: "look", title: "Who's in it, and what style?", sub: "A character keeps the same person on every slide." },
  { id: "slides", title: "Slides, shape and footage", sub: "Use your own video for free photos." },
  { id: "go", title: "Ready to make it", sub: "Check the summary, then we'll build it." },
];

interface Slot {
  slide: number;
  half: 0 | 1;
  scene: string;
  person: PlannedSlide["person"];
  frame?: string;
  url?: string;
  view?: string;
  state: "wait" | "work" | "ok" | "fail";
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>, stop: () => boolean) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length && !stop()) {
        const x = items[i++];
        await fn(x);
      }
    }),
  );
}

export default function SlideshowWizard({
  brandId,
  initialTopic,
  onClose,
  onDone,
  onInsufficient,
}: {
  brandId: string;
  initialTopic?: string;
  onClose: () => void;
  onDone: (r: SlideshowResult) => void;
  onInsufficient?: (neededMilli?: number) => void;
}) {
  const [i, setI] = useState(0);
  const [topic, setTopic] = useState(initialTopic || "");
  const [format, setFormat] = useState<SlideshowFormat>("list");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterId, setCharacterId] = useState("");
  const [styles, setStyles] = useState<StyleCard[]>([]);
  const [styleId, setStyleId] = useState("");
  const [count, setCount] = useState(6);
  const [aspect, setAspect] = useState<SlideshowAspect>("3:4");
  const [frames, setFrames] = useState<string[]>([]);
  const [modal, setModal] = useState<"" | "char" | "style" | "video">("");

  // running
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState("");
  const stopRef = useMemo(() => ({ stop: false }), []);

  const loadStyles = () =>
    fetch("/api/slideshow/styles").then((r) => r.json()).then((d) => setStyles(d.styles || [])).catch(() => setStyles([]));
  useEffect(() => {
    fetch(`/api/slideshow/character?brandId=${encodeURIComponent(brandId)}`).then((r) => r.json()).then((d) => setCharacters(d.characters || [])).catch(() => {});
    loadStyles();
  }, [brandId]);

  // Frames are cropped for one shape; changing the shape or format starts over.
  useEffect(() => setFrames([]), [format, aspect]);

  const perSlide = format === "split" ? 2 : 1;
  const photoSlots = count * perSlide;
  const frameUse = Math.min(frames.length, photoSlots);
  const aiPhotos = photoSlots - frameUse;
  const character = characters.find((c) => c.id === characterId) || null;
  const style = styles.find((s) => s.id === styleId) || null;
  const visibleStyles = styles.filter((s) => !s.formats.length || s.formats.includes(format));
  const frameRatio = format === "split" ? HALF_PX.w / HALF_PX.h : ASPECT_PX[aspect].ratio;

  async function addCharacter(c: Character) {
    const next = [...characters, c];
    setModal("");
    const r = await fetch("/api/slideshow/character", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId, characters: next }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setCharacters(d.characters || next);
      setCharacterId(c.id);
    } else {
      setError(d.error || "Couldn't save the character");
    }
  }

  async function run() {
    stopRef.stop = false;
    setRunning(true);
    setError("");
    setSlots([]);
    let halted = false;
    const stop = () => stopRef.stop || halted;
    try {
      // ---- 1. plan ----
      setStatus("Planning your slides…");
      const slotOrder = (n: number) => [...Array.from({ length: n - 1 }, (_, k) => k + 1), 0];
      const pr = await fetch("/api/slideshow/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, topic, format, count, characterId: characterId || undefined, styleId: styleId || undefined, frameSlots: frameUse }),
      });
      const pj = await pr.json().catch(() => ({}));
      if (pr.status === 402) {
        onInsufficient?.(pj.neededMilli);
        throw new Error("You're out of credits.");
      }
      if (!pr.ok) throw new Error(pj.error || "Couldn't plan the slideshow");
      const plan: { title: string; slides: PlannedSlide[] } = pj.plan;
      const look: CaptionLook = pj.textStyle || style?.textStyle || "white";

      // ---- 2. photo slots, with frames filling the first ones (from slide 2 on) ----
      const all: Slot[] = [];
      plan.slides.forEach((p, idx) => {
        all.push({ slide: idx, half: 0, scene: p.scene, person: p.person, state: "wait" });
        if (p.kind === "split") all.push({ slide: idx, half: 1, scene: p.scene2, person: p.person, state: "wait" });
      });
      let fi = 0;
      for (const idx of slotOrder(plan.slides.length)) {
        for (const s of all.filter((x) => x.slide === idx)) if (fi < frames.length) s.frame = frames[fi++];
      }
      setSlots([...all]);
      const bump = () => setSlots([...all]);

      // ---- 3. make the photos (2 at a time) ----
      const total = all.length;
      const doneCount = () => all.filter((s) => s.state === "ok" || s.state === "fail").length;
      setStatus(`Making photos… 0 of ${total}`);
      await pool(
        all,
        2,
        async (s) => {
          s.state = "work";
          bump();
          for (let attempt = 0; attempt < 2 && s.state !== "ok" && !stop(); attempt++) {
            try {
              if (s.frame) {
                const up = await uploadData(s.frame);
                s.url = up.url;
                s.view = up.viewUrl;
                s.state = "ok";
              } else {
                const r = await fetch("/api/slideshow/slide", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ brandId, scene: s.scene, person: s.person, characterId: characterId || undefined, styleId: styleId || undefined, landscape: format === "split", aspect }),
                });
                const d = await r.json().catch(() => ({}));
                if (r.status === 402) {
                  halted = true;
                  onInsufficient?.(d.neededMilli);
                  break;
                }
                if (!r.ok) throw new Error(d.error || "failed");
                s.url = d.url;
                s.view = d.viewUrl || d.url;
                s.state = "ok";
              }
            } catch {
              /* retry once */
            }
          }
          if (s.state !== "ok") s.state = "fail";
          bump();
          setStatus(`Making photos… ${doneCount()} of ${total}`);
        },
        stop,
      );

      // ---- 4. assemble slides (stack 2-in-1) ----
      setStatus("Putting your slides together…");
      const px = ASPECT_PX[aspect];
      const slides: CarouselSlideMessage[] = [];
      const rawUrls: string[] = [];
      for (let idx = 0; idx < plan.slides.length; idx++) {
        const p = plan.slides[idx];
        const mine = all.filter((s) => s.slide === idx);
        let view = "";
        let raw = "";
        if (p.kind === "split") {
          if (mine.length === 2 && mine.every((s) => s.state === "ok")) {
            try {
              const stacked = await stackImages(mine[0].view!, mine[1].view!, px.w, px.h);
              const up = await uploadData(stacked);
              view = up.viewUrl;
              raw = up.url;
            } catch {
              view = "";
            }
          }
        } else if (mine[0]?.state === "ok") {
          view = mine[0].view!;
          raw = mine[0].url!;
        }
        if (raw) rawUrls.push(raw);
        const two = p.kind === "split";
        slides.push({
          slideNumber: idx + 1,
          role: idx === 0 ? "hook" : idx === plan.slides.length - 1 ? "cta" : "slide",
          headline: p.text,
          body: two ? p.text2 : p.detail,
          imageUrl: view,
          headlineBox: two ? { x: 0.07, y: 0.04, w: 0.86, h: 0.18 } : { x: 0.08, y: 0.06, w: 0.84, h: 0.2 },
          bodyBox: two ? { x: 0.07, y: 0.54, w: 0.86, h: 0.18 } : { x: 0.08, y: 0.66, w: 0.78, h: 0.26 },
          headlineAlign: "center",
          bodyAlign: two ? "center" : "left",
          captionStyle: look,
          bodyKind: two ? "h1" : "p",
        });
      }
      if (!slides.some((s) => s.imageUrl)) throw new Error(halted ? "You're out of credits." : "None of the photos could be made. You were only charged for photos that finished.");

      // ---- 5. save to Files ----
      let generationId: string | null = null;
      try {
        const sv = await fetch("/api/slideshow/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, title: plan.title, imageUrls: rawUrls, format, texts: plan.slides.map((p) => [p.text, p.detail || p.text2]) }),
        });
        generationId = (await sv.json().catch(() => ({}))).generationId ?? null;
      } catch {
        /* saving to Files is best effort */
      }
      onDone({ title: plan.title, slides, generationId, format });
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setRunning(false);
    }
  }

  // ==================== Running view ====================
  if (running) {
    const done = slots.filter((s) => s.state === "ok").length;
    return (
      <LModal title="Making your slideshow" sub={status} onClose={() => { stopRef.stop = true; onClose(); }} footer={<LButton variant="secondary" onClick={() => { stopRef.stop = true; onClose(); }}>Stop</LButton>}>
        <div className="grid grid-cols-4 gap-2">
          {(slots.length ? slots : Array.from({ length: photoSlots }, () => ({ state: "wait" as const, view: "" }))).map((s, k) => (
            <div key={k} className="aspect-[3/4] rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
              {s.state === "ok" && s.view ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.view} alt="" className="w-full h-full object-cover" />
              ) : s.state === "work" ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              ) : s.state === "fail" ? (
                <X className="w-5 h-5 text-red-400" />
              ) : (
                <span className="text-xs text-gray-300">{k + 1}</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">{slots.length ? `${done} of ${slots.length} photos ready.` : ""} Photos are made two at a time. You can edit the text once it's done.</p>
      </LModal>
    );
  }

  const canNext = i === 0 ? topic.trim().length >= 4 : true;

  return (
    <>
      <WizardShell
        wide
        heading="TikTok slideshow"
        steps={STEPS}
        index={i}
        continueDisabled={!canNext}
        finishLabel="Make slideshow"
        onBack={() => setI((x) => Math.max(0, x - 1))}
        onNext={() => (i === STEPS.length - 1 ? run() : setI((x) => x + 1))}
        onClose={onClose}
      >
        {i === 0 && (
          <div className="space-y-5">
            <Field label="Topic">
              <LTextarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. money habits that helped me save my first $100k, or 3 days in Lisbon" autoFocus />
            </Field>
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Format</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {FORMATS.map((f) => (
                  <button key={f.key} type="button" onClick={() => setFormat(f.key)} className={`text-left rounded-xl border p-3 ${format === f.key ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {i === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Character</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setCharacterId("")} className={`rounded-xl border px-3 py-2 text-sm ${!characterId ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>No character</button>
                {characters.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCharacterId(c.id)} className={`flex items-center gap-2 rounded-xl border pl-1.5 pr-3 py-1.5 text-sm ${characterId === c.id ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.photos[0]} alt="" className="w-8 h-8 rounded-full object-cover" />
                    {c.name}
                  </button>
                ))}
                <button type="button" onClick={() => setModal("char")} className="flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400"><Plus className="w-4 h-4" /> Add character</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">{character ? `${character.name} appears on the slides that show a person; their photos keep the face consistent.` : "Without a character, people only appear from behind or as hands, and many slides show places and details."}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Style</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <button type="button" onClick={() => setStyleId("")} className={`rounded-xl border p-2 text-left ${!styleId ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="aspect-[3/4] rounded-lg bg-gray-100 flex items-center justify-center text-gray-400"><UserRound className="w-5 h-5" /></div>
                  <p className="text-xs font-medium text-gray-800 mt-1.5">Default</p>
                </button>
                {visibleStyles.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStyleId(s.id)} className={`rounded-xl border p-2 text-left ${styleId === s.id ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className="aspect-[3/4] rounded-lg bg-gray-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {s.cover && <img src={s.cover} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <p className="text-xs font-medium text-gray-800 mt-1.5 truncate">{s.name}{s.mine ? " (yours)" : ""}</p>
                  </button>
                ))}
                <button type="button" onClick={() => setModal("style")} className="rounded-xl border border-dashed border-gray-300 p-2 text-gray-500 hover:border-gray-400 flex flex-col items-center justify-center gap-1 aspect-[3/4] self-start"><Plus className="w-5 h-5" /><span className="text-xs">My style</span></button>
              </div>
            </div>
          </div>
        )}

        {i === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">How many slides</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setCount((c) => Math.max(3, c - 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-lg">−</button>
                <span className="w-8 text-center text-lg font-semibold">{count}</span>
                <button type="button" onClick={() => setCount((c) => Math.min(10, c + 1))} className="w-9 h-9 rounded-lg border border-gray-200 text-lg">+</button>
                <span className="text-xs text-gray-500">3 to 10{format === "split" ? " (each has two photos)" : ""}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Shape</p>
              <div className="flex gap-3">
                {([{ v: "3:4", t: "3:4", s: "TikTok photo mode (recommended)" }, { v: "9:16", t: "9:16", s: "Full screen" }] as const).map((o) => (
                  <button key={o.v} type="button" onClick={() => setAspect(o.v)} className={`flex items-center gap-3 rounded-xl border p-3 ${aspect === o.v ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className="border-2 border-gray-700 rounded-sm" style={{ width: o.v === "3:4" ? 30 : 24, height: o.v === "3:4" ? 40 : 42 }} />
                    <div className="text-left"><p className="text-sm font-semibold text-gray-900">{o.t}</p><p className="text-xs text-gray-500">{o.s}</p></div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 mb-1">Your own video (optional)</p>
              <p className="text-xs text-gray-500 mb-2">Pick frames from a video. They fill photo slots for free; one video can fill many slides.</p>
              {frames.length > 0 && (
                <div className="flex gap-1.5 mb-2 overflow-x-auto">
                  {frames.map((f, k) => (
                    <div key={k} className="relative shrink-0 w-14 rounded-md overflow-hidden border border-gray-200" style={{ aspectRatio: String(frameRatio) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setFrames((p) => p.filter((_, j) => j !== k))} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}
                </div>
              )}
              <LButton variant="secondary" icon={<Film className="w-4 h-4" />} onClick={() => setModal("video")}>{frames.length ? "Change frames" : "Choose a video"}</LButton>
            </div>
          </div>
        )}

        {i === 3 && (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
              {[
                ["Topic", topic.trim()],
                ["Format", FORMATS.find((f) => f.key === format)?.name || ""],
                ["Slides", `${count} slides, ${aspect}`],
                ["Character", character ? character.name : "None"],
                ["Style", style ? style.name : "Default"],
                ["Photos", `${aiPhotos} made by AI${frameUse ? `, ${frameUse} from your video (free)` : ""}`],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 px-4 py-2.5">
                  <span className="w-24 shrink-0 text-gray-500">{k}</span>
                  <span className="text-gray-900 break-words min-w-0">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 flex items-start gap-1.5"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Credits are charged per photo that finishes, plus a small amount for planning. Photos with no words in them; you add text next.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </WizardShell>

      {modal === "char" && <CharacterWizard onClose={() => setModal("")} onCreated={addCharacter} onInsufficient={onInsufficient} />}
      {modal === "style" && (
        <SlideshowStyleWizard
          onClose={() => setModal("")}
          onInsufficient={onInsufficient}
          onCreated={(id) => {
            setModal("");
            loadStyles().then(() => setStyleId(id));
          }}
        />
      )}
      {modal === "video" && (
        <VideoFramePicker
          ratio={frameRatio}
          want={photoSlots}
          onClose={() => setModal("")}
          onPick={(f) => {
            setFrames(f);
            setModal("");
          }}
        />
      )}
    </>
  );
}
