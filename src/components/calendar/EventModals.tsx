// ============================================================
// UXLLY — Calendar: post + automation detail popups
// (planned posts reuse PlanItemModal)
// ============================================================
"use client";

import { useState } from "react";
import { Check, Copy, Pause, Play, Trash2, X } from "lucide-react";
import { LButton, LBadge } from "@/components/ui/light";
import { parseSchedule } from "@/lib/jobs";

export interface JobRow {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  platform: string;
  isActive: boolean;
  lastRunAt: string | null;
  channel?: { name: string; brand?: { name: string } };
}
export interface PostRow {
  id: string;
  caption: string | null;
  imageUrl: string | null;
  platform: string;
  status: string;
  scheduledAt: string | null;
  channel?: { name: string };
}

function Pop({ title, sub, onClose, children, footer }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate">{title}</p>
            {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function PostModal({ post, onClose }: { post: PostRow; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pop title={post.channel?.name || "Generated post"} sub={post.scheduledAt ? new Date(post.scheduledAt).toLocaleString([], { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""} onClose={onClose}>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="w-full max-h-[50vh] object-contain rounded-xl border border-gray-100 bg-gray-50" />
      )}
      {post.caption && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">Caption</p>
            <button onClick={() => { navigator.clipboard.writeText(post.caption || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1">{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}</button>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[13px] text-gray-800 whitespace-pre-wrap">{post.caption}</div>
        </div>
      )}
    </Pop>
  );
}

export function JobModal({ job, onClose, onChanged }: { job: JobRow; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const { times, timeZone } = parseSchedule(job.schedule);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn().catch(() => {});
    setBusy(false);
    onChanged();
    onClose();
  };
  return (
    <Pop
      title={job.name}
      sub="Automation"
      onClose={onClose}
      footer={
        <>
          <LButton variant="danger" size="sm" icon={<Trash2 size={14} />} disabled={busy} onClick={() => confirm("Delete this automation?") && act(() => fetch(`/api/jobs/${job.id}`, { method: "DELETE" }))}>Delete</LButton>
          <LButton variant="secondary" size="sm" icon={job.isActive ? <Pause size={14} /> : <Play size={14} />} disabled={busy} onClick={() => act(() => fetch(`/api/jobs/${job.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !job.isActive }) }))}>{job.isActive ? "Pause" : "Resume"}</LButton>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <LBadge tone={job.isActive ? "success" : "neutral"}>{job.isActive ? "Running" : "Paused"}</LBadge>
        <LBadge>{times.join(" · ")}</LBadge>
        <LBadge>{timeZone}</LBadge>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">Brief</p>
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[13px] text-gray-800 whitespace-pre-wrap">{job.prompt}</div>
      </div>
      {job.lastRunAt && <p className="text-xs text-gray-500">Last ran {new Date(job.lastRunAt).toLocaleString()}</p>}
    </Pop>
  );
}
