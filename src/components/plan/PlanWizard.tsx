// ============================================================
// UXLLY — Content plan wizard
//   1. Setup (pre-filled from onboarding)  2. AI drafts the plan
//   3. Review & edit the drafts            4. Approve
// Drafts live on the calendar. Nothing is generated (no credits) until
// the plan is approved, and then only about a day before each slot.
// ============================================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { GOALS, PLATFORMS, POSTS_PER_DAY } from "@/lib/onboarding";

interface BrandLite {
  id: string;
  name: string;
}
export interface PlanItemLite {
  id: string;
  scheduledAt: string;
  platform: string;
  format: string;
  size: string;
  topic: string;
  theme: string | null;
  status: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const whenText = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const SHARE = [
  { label: "Mostly single ads", value: 0.15 },
  { label: "Balanced", value: 0.3 },
  { label: "More carousels", value: 0.5 },
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-full text-[13px] border transition-colors ${on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
      {children}
    </button>
  );
}

export default function PlanWizard({
  initial,
  onClose,
  onChanged,
}: {
  initial?: { brandId?: string; days?: number; brief?: string };
  onClose: () => void;
  onChanged: () => void;
}) {
  const [step, setStep] = useState<"setup" | "drafting" | "review" | "done">("setup");
  const [brands, setBrands] = useState<BrandLite[]>([]);
  const [brandId, setBrandId] = useState(initial?.brandId || "");
  const tomorrow = useMemo(() => ymd(new Date(Date.now() + 86400000)), []);
  const [startDate, setStartDate] = useState(tomorrow);
  const [days, setDays] = useState(initial?.days || 30);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [perDay, setPerDay] = useState("1");
  const [goals, setGoals] = useState<string[]>([]);
  const [share, setShare] = useState(0.3);
  const [brief, setBrief] = useState(initial?.brief || "");
  const [error, setError] = useState("");
  const [planId, setPlanId] = useState("");
  const [items, setItems] = useState<PlanItemLite[]>([]);
  const [trimmed, setTrimmed] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => {
      if (!d?.success) return;
      const list = (d.data as BrandLite[]).map((b) => ({ id: b.id, name: b.name }));
      setBrands(list);
      setBrandId((cur) => cur || list[0]?.id || "");
    }).catch(() => {});
    // Pre-fill from what they told us when they signed up.
    fetch("/api/onboarding").then((r) => r.json()).then((d) => {
      const a = d?.answers;
      if (!a) return;
      if (Array.isArray(a.platforms) && a.platforms.length) setPlatforms(a.platforms.slice(0, 4));
      if (a.postsPerDay) setPerDay(a.postsPerDay);
      if (Array.isArray(a.goals) && a.goals.length) setGoals(a.goals.slice(0, 3));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && step !== "drafting" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, step]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const draft = async () => {
    setError("");
    setStep("drafting");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId, startDate, days, platforms, postsPerDay: perDay, goals, brief: brief.trim() || undefined, carouselShare: share,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error("You're out of credits. Top up to draft a plan.");
      if (!d.success) throw new Error(d.error || "Could not draft the plan");
      setPlanId(d.data.id);
      setItems(d.data.items);
      setTrimmed(!!d.trimmed);
      setStep("review");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setStep("setup");
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...body } as PlanItemLite : it)));
    await fetch(`/api/plans/${planId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id, ...body }) });
    onChanged();
  };
  const remove = async (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    await fetch(`/api/plans/${planId}?itemId=${id}`, { method: "DELETE" });
    onChanged();
  };
  const approve = async () => {
    setApproving(true);
    const res = await fetch(`/api/plans/${planId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
    setApproving(false);
    if (res.ok) {
      setStep("done");
      onChanged();
    } else setError("Could not approve the plan");
  };

  const canDraft = !!brandId && platforms.length > 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => step !== "drafting" && onClose()} aria-hidden />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <div className="w-7 h-7 rounded-lg bg-[#A3F76B] flex items-center justify-center"><Sparkles size={15} /></div>
            {step === "review" ? "Review your plan" : step === "done" ? "Plan approved" : "Plan your content"}
          </div>
          {step !== "drafting" && <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close"><X size={16} /></button>}
        </div>

        {step === "setup" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-5">
              <p className="text-sm text-gray-500">Tell me what to plan and I'll fill your calendar with post ideas to review. Nothing is created or charged until you approve.</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-gray-600">Project
                  <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-gray-600">Start date
                  <input type="date" min={tomorrow} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900" />
                </label>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">How long</p>
                <div className="flex flex-wrap gap-2">{[7, 14, 30, 60].map((n) => <Chip key={n} on={days === n} onClick={() => setDays(n)}>{n} days</Chip>)}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Platforms</p>
                <div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => <Chip key={p.value} on={platforms.includes(p.value)} onClick={() => toggle(platforms, setPlatforms, p.value)}>{p.label}</Chip>)}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">How often</p>
                <div className="flex flex-wrap gap-2">{POSTS_PER_DAY.map((p) => <Chip key={p.value} on={perDay === p.value} onClick={() => setPerDay(p.value)}>{p.label}</Chip>)}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Goals</p>
                <div className="flex flex-wrap gap-2">{GOALS.map((g) => <Chip key={g.value} on={goals.includes(g.value)} onClick={() => toggle(goals, setGoals, g.value)}>{g.label}</Chip>)}</div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Mix</p>
                <div className="flex flex-wrap gap-2">{SHARE.map((s) => <Chip key={s.label} on={share === s.value} onClick={() => setShare(s.value)}>{s.label}</Chip>)}</div>
              </div>
              <label className="block text-xs font-medium text-gray-600">Anything specific? <span className="font-normal text-gray-400">(launches, promos, dates, themes)</span>
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} placeholder="e.g. New menu launches on the 15th. Push the weekend brunch offer every Friday." className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none" />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Holidays and Nigerian dates are added automatically.</p>
              <button onClick={draft} disabled={!canDraft} className="rounded-full bg-gray-900 text-white text-sm font-medium px-5 py-2.5 disabled:opacity-40">Draft my plan</button>
            </div>
          </>
        )}

        {step === "drafting" && (
          <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
            <Loader2 className="animate-spin text-gray-500" size={26} />
            <p className="text-sm font-medium text-gray-900">Planning your {days} days…</p>
            <p className="text-xs text-gray-500">Reading your brand, the calendar and your goals. This takes about a minute.</p>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
              <p className="text-sm text-gray-500 pb-1">{items.length} posts drafted. Edit anything, remove what you don't want, then approve.{trimmed ? " (Capped at 90 posts: run another plan for the rest.)" : ""}</p>
              {items.map((it) => (
                <div key={it.id} className="rounded-xl border border-gray-200 p-3 flex gap-3 items-start">
                  <div className="w-36 shrink-0 space-y-1.5">
                    <input type="datetime-local" defaultValue={toLocalInput(it.scheduledAt)} onBlur={(e) => e.target.value && patch(it.id, { scheduledAt: new Date(e.target.value).toISOString() })} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700" />
                    <div className="flex gap-1">
                      <span className="rounded-full bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 capitalize">{it.platform}</span>
                      <button onClick={() => patch(it.id, { format: it.format === "carousel" ? "single" : "carousel" })} className={`rounded-full text-[10px] px-2 py-0.5 ${it.format === "carousel" ? "bg-[#A3F76B] text-gray-900" : "bg-gray-100 text-gray-600"}`}>{it.format === "carousel" ? "Carousel" : "Single"}</button>
                    </div>
                  </div>
                  <textarea defaultValue={it.topic} rows={3} onBlur={(e) => e.target.value.trim() && e.target.value !== it.topic && patch(it.id, { topic: e.target.value })} className="flex-1 rounded-lg border border-transparent hover:border-gray-200 focus:border-gray-400 bg-transparent px-2 py-1 text-[13px] text-gray-800 resize-none outline-none" />
                  <button onClick={() => remove(it.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50" aria-label="Remove"><Trash2 size={14} /></button>
                </div>
              ))}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">Approving doesn't charge anything. Each post is made about a day before it's due, then emailed to you at its time.</p>
              <button onClick={approve} disabled={approving || items.length === 0} className="shrink-0 rounded-full bg-gray-900 text-white text-sm font-medium px-5 py-2.5 disabled:opacity-40">{approving ? "Approving…" : `Approve ${items.length} posts`}</button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="px-6 py-14 flex flex-col items-center text-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#A3F76B] flex items-center justify-center"><Check size={22} strokeWidth={3} /></div>
            <p className="text-base font-semibold text-gray-900">Your plan is on the calendar</p>
            <p className="text-sm text-gray-500 max-w-sm">I'll make each post about a day before it's due and email it to you with the caption at posting time. Credits are only used as each post is made.</p>
            <button onClick={onClose} className="mt-2 rounded-full bg-gray-900 text-white text-sm font-medium px-5 py-2.5">Back to calendar</button>
          </div>
        )}
      </div>
    </div>
  );
}
