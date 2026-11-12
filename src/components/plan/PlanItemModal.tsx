// ============================================================
// UXLLY — One planned post: preview, edit while it's still a draft,
// copy the caption, mark as posted.
// ============================================================
"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

export interface CalendarPlanItem {
  id: string;
  planId: string;
  scheduledAt: string;
  platform: string;
  format: string;
  size: string;
  topic: string;
  theme: string | null;
  caption: string | null;
  hashtags: string[];
  imageUrls: string[];
  status: string;
  error: string | null;
}

export const STATUS_STYLE: Record<string, { label: string; dot: string; chip: string }> = {
  draft: { label: "Draft", dot: "bg-gray-300", chip: "bg-gray-100 text-gray-600" },
  approved: { label: "Approved", dot: "bg-blue-400", chip: "bg-blue-50 text-blue-700" },
  generating: { label: "Making it…", dot: "bg-amber-400", chip: "bg-amber-50 text-amber-700" },
  ready: { label: "Ready", dot: "bg-emerald-400", chip: "bg-emerald-50 text-emerald-700" },
  sent: { label: "Emailed", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  posted: { label: "Posted", dot: "bg-gray-900", chip: "bg-gray-900 text-white" },
  failed: { label: "Needs attention", dot: "bg-red-400", chip: "bg-red-50 text-red-700" },
};

export default function PlanItemModal({ item, onClose, onChanged }: { item: CalendarPlanItem; onClose: () => void; onChanged: () => void }) {
  const [topic, setTopic] = useState(item.topic);
  const [copied, setCopied] = useState(false);
  const editable = ["draft", "approved", "failed"].includes(item.status);
  const st = STATUS_STYLE[item.status] || STATUS_STYLE.draft;
  const fullCaption = [item.caption, item.hashtags.join(" ")].filter(Boolean).join("\n\n");

  const patch = async (body: Record<string, unknown>) => {
    await fetch(`/api/plans/${item.planId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, ...body }) });
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 capitalize">{item.platform} · {item.format}</p>
            <p className="text-xs text-gray-500">{new Date(item.scheduledAt).toLocaleString([], { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full text-[11px] px-2.5 py-1 ${st.chip}`}>{st.label}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-4">
          {item.imageUrls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {item.imageUrls.map((u, i) => (
                <a key={u + i} href={u} target="_blank" rel="noreferrer" className="shrink-0"><img src={u} alt={`Slide ${i + 1}`} className="h-56 rounded-xl border border-gray-100" /></a>
              ))}
            </div>
          )}
          {editable ? (
            <label className="block text-xs font-medium text-gray-600">What this post is about
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 resize-none" />
            </label>
          ) : (
            <p className="text-sm text-gray-700">{item.topic}</p>
          )}
          {item.error && <p className="text-sm text-red-600">{item.error}</p>}
          {fullCaption && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-600">Caption</p>
                <button onClick={() => { navigator.clipboard.writeText(fullCaption); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1">{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}</button>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[13px] text-gray-800 whitespace-pre-wrap">{fullCaption}</div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {editable && item.status !== "failed" && <button onClick={async () => { await patch({ skip: true }); onClose(); }} className="rounded-full border border-gray-200 text-sm text-gray-600 px-4 py-2 hover:border-gray-400">Skip this post</button>}
            {item.status === "failed" && <button onClick={async () => { await patch({ retry: true }); onClose(); }} className="rounded-full border border-gray-200 text-sm text-gray-700 px-4 py-2 hover:border-gray-400">Try again</button>}
          </div>
          <div className="flex gap-2">
            {editable && topic.trim() !== item.topic && <button onClick={async () => { await patch({ topic }); onClose(); }} className="rounded-full bg-gray-900 text-white text-sm font-medium px-5 py-2">Save</button>}
            {["ready", "sent"].includes(item.status) && <button onClick={async () => { await patch({ posted: true }); onClose(); }} className="rounded-full bg-gray-900 text-white text-sm font-medium px-5 py-2">I've posted it</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
