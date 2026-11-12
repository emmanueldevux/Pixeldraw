// ============================================================
// UXLLY — Video frame picker
// The video never leaves the browser: frames are read here for free, blurry
// ones are flagged, the sharpest are pre-selected. The picked frames can be
// used on several slides (and in 2-in-1 slides), so one video makes a whole
// slideshow without spending credits on photos.
// ============================================================
"use client";

import { useRef, useState } from "react";
import { Check, Film, Loader2 } from "lucide-react";
import LModal from "@/components/ui/LModal";
import { LButton } from "@/components/ui/light";
import { autoPick, extractFrames, type Frame } from "@/lib/slideshow/frames";

export default function VideoFramePicker({
  ratio,
  want,
  onClose,
  onPick,
}: {
  ratio: number; // width / height of one photo slot
  want: number; // how many frames the slideshow can use
  onClose: () => void;
  onPick: (frames: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");

  async function onFile(f: File | null) {
    if (!f) return;
    setError("");
    if (f.size > 700 * 1024 * 1024) return setError("That video is over 700 MB. Trim it first.");
    setProgress({ done: 0, total: 24 });
    try {
      const out = await extractFrames(f, { ratio, count: 24, onProgress: (done, total) => setProgress({ done, total }) });
      setFrames(out);
      setSelected(autoPick(out, Math.min(want, 8)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 16 ? s : [...s, id]));
  const chosen = selected.map((id) => frames?.find((f) => f.id === id)?.dataUrl).filter((x): x is string => !!x);

  return (
    <LModal
      title="Use frames from a video"
      sub="Free: the video stays on your device. Pick the moments you like; they can be used on several slides."
      onClose={onClose}
      wide
      footer={
        frames ? (
          <>
            <span className="mr-auto text-sm text-gray-500">{selected.length} selected</span>
            <LButton variant="secondary" onClick={() => input.current?.click()}>Different video</LButton>
            <LButton disabled={!selected.length} onClick={() => onPick(chosen)}>Use {selected.length || ""} frame{selected.length === 1 ? "" : "s"}</LButton>
          </>
        ) : undefined
      }
    >
      <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      {!frames && !progress && (
        <button type="button" onClick={() => input.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-gray-300 hover:border-gray-400 py-14 flex flex-col items-center gap-2 text-gray-500">
          <Film className="w-8 h-8" />
          <span className="text-sm font-medium text-gray-800">Choose a video</span>
          <span className="text-xs">MP4 or MOV, up to 700 MB</span>
        </button>
      )}
      {progress && (
        <div className="py-14 flex flex-col items-center gap-3 text-gray-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Reading the video… {progress.done} of {progress.total}</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {frames && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {frames.map((f) => {
            const idx = selected.indexOf(f.id);
            return (
              <button key={f.id} type="button" onClick={() => toggle(f.id)} className={`relative rounded-lg overflow-hidden border-2 ${idx >= 0 ? "border-gray-900" : "border-transparent"}`} style={{ aspectRatio: String(ratio) }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.dataUrl} alt="" className="w-full h-full object-cover" />
                {f.blurry && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1.5 py-0.5">blurry</span>}
                {idx >= 0 && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] flex items-center justify-center">
                    {idx + 1 < 10 ? idx + 1 : <Check className="w-3 h-3" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </LModal>
  );
}
