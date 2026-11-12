// ============================================================
// UXLLY — Calendar (posts, content plans and automations in one place)
// Desktop: sidebar (mini calendar, automations, platforms) + Day/Week/Month.
// Mobile: day strip + tabs (Posts / Automations / Occasions) + cards.
// ============================================================
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday,
  startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Megaphone, Plus, Search, Sparkles, Zap } from "lucide-react";
import PlanWizard from "@/components/plan/PlanWizard";
import JobWizard from "@/components/plan/JobWizard";
import PlanItemModal, { STATUS_STYLE, type CalendarPlanItem } from "@/components/plan/PlanItemModal";
import { JobModal, PostModal, type JobRow, type PostRow } from "@/components/calendar/EventModals";
import { FAMILY_LABEL, HOUR_H, TONE, familyOf, type Ev } from "@/components/calendar/shared";
import { LBadge, LButton, Toggle } from "@/components/ui/light";
import { occasionsBetween } from "@/lib/plan/holidays";
import { occurrencesOn, parseSchedule } from "@/lib/jobs";
import { useAuthGate } from "@/components/auth/AuthGate";

type View = "day" | "week" | "month";
type Tab = "posts" | "automations" | "occasions";

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;

// ---------- one event card ----------
function EventCard({ ev, onOpen, compact }: { ev: Ev; onOpen: (e: Ev) => void; compact?: boolean }) {
  const tone = TONE[ev.family] || TONE.other;
  const st = STATUS_STYLE[ev.status];
  return (
    <button
      type="button"
      onClick={() => onOpen(ev)}
      className={`w-full h-full text-left rounded-xl border px-2.5 py-1.5 overflow-hidden transition-shadow hover:shadow-md ${tone.bg} ${tone.bd} ${ev.kind === "auto" ? "border-dashed" : ""}`}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
        <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
        {FAMILY_LABEL[ev.family]} · {format(ev.at, "HH:mm")}
        {ev.kind === "auto" && <Zap size={10} className="text-gray-400" />}
        {st && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${st.dot}`} title={st.label} />}
      </span>
      <span className={`block text-[12px] font-semibold text-gray-900 leading-snug ${compact ? "truncate" : "line-clamp-2"}`}>{ev.title}</span>
    </button>
  );
}

// ---------- hour grid (day + week) ----------
function TimeGrid({ days, events, onOpen }: { days: Date[]; events: Ev[]; onOpen: (e: Ev) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    scroller.current?.scrollTo({ top: Math.max(0, (new Date().getHours() - 2) * HOUR_H) });
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const cols = days.map((d) => {
    const list = events.filter((e) => isSameDay(e.at, d)).sort((a, b) => +a.at - +b.at);
    const laneEnds: number[] = [];
    const placed = list.map((e) => {
      const start = e.at.getHours() * 60 + e.at.getMinutes();
      let lane = laneEnds.findIndex((end) => end <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = start + 60;
      return { e, start, lane };
    });
    return { d, placed, lanes: Math.max(1, laneEnds.length) };
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[420px]">
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="px-2 py-3 text-[10px] text-gray-400 text-center">{format(now, "xxx").replace("+", "GMT+")}</div>
        {days.map((d) => (
          <div key={d.toISOString()} className="py-2.5 text-center border-l border-gray-100">
            <p className="text-[12px] text-gray-500">{format(d, "EEEE")}</p>
            <span className={`inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-full text-[13px] font-semibold ${isToday(d) ? "bg-gray-900 text-white" : "text-gray-900"}`}>{format(d, "d")}</span>
          </div>
        ))}
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto">
        <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ height: HOUR_H }} className="pr-2 text-right text-[10px] text-gray-400 -translate-y-1.5">{h === 0 ? "" : hourLabel(h)}</div>
            ))}
          </div>
          {cols.map(({ d, placed, lanes }) => (
            <div key={d.toISOString()} className="relative border-l border-gray-100" style={{ height: 24 * HOUR_H, backgroundImage: `linear-gradient(to bottom, #F1F1F3 1px, transparent 1px)`, backgroundSize: `100% ${HOUR_H}px` }}>
              {placed.map(({ e, start, lane }) => (
                <div key={e.id} className="absolute px-0.5" style={{ top: (start / 60) * HOUR_H + 1, height: HOUR_H - 4, left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}>
                  <EventCard ev={e} onOpen={onOpen} compact={lanes > 1} />
                </div>
              ))}
              {isToday(d) && (
                <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_H }}>
                  <div className="h-px bg-gray-900" />
                  <span className="absolute -left-1 -top-[9px] rounded-full bg-gray-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">{format(now, "HH:mm")}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- month grid ----------
function MonthGrid({ cursor, events, onOpen, onDay }: { cursor: Date; events: Ev[]; onOpen: (e: Ev) => void; onDay: (d: Date) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) });
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-gray-500">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = events.filter((e) => isSameDay(e.at, d)).sort((a, b) => +a.at - +b.at);
          return (
            <div key={d.toISOString()} className={`min-h-[116px] border-b border-r border-gray-100 p-1.5 ${isSameMonth(d, cursor) ? "bg-white" : "bg-gray-50/60"}`}>
              <button onClick={() => onDay(d)} className={`mb-1 inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-full text-[12px] font-semibold ${isToday(d) ? "bg-gray-900 text-white" : isSameMonth(d, cursor) ? "text-gray-900 hover:bg-gray-100" : "text-gray-300"}`}>{format(d, "d")}</button>
              <div className="space-y-1">
                {list.slice(0, 3).map((e) => {
                  const tone = TONE[e.family] || TONE.other;
                  return (
                    <button key={e.id} onClick={() => onOpen(e)} title={e.title} className={`w-full flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left ${tone.bg} ${tone.bd} ${e.kind === "auto" ? "border-dashed" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
                      <span className="text-[10px] text-gray-800 truncate">{format(e.at, "HH:mm")} {e.title}</span>
                    </button>
                  );
                })}
                {list.length > 3 && <button onClick={() => onDay(d)} className="px-1 text-[10px] text-gray-500 hover:text-gray-900">+{list.length - 3} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- mini month (desktop sidebar) ----------
function MiniMonth({ cursor, setCursor, hasEvents }: { cursor: Date; setCursor: (d: Date) => void; hasEvents: (d: Date) => boolean }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) });
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCursor(subMonths(cursor, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={15} /></button>
        <p className="text-[13px] font-semibold text-gray-900">{format(cursor, "MMMM yyyy")}</p>
        <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={15} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-gray-400 mb-1">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const sel = isSameDay(d, cursor);
          return (
            <button key={d.toISOString()} onClick={() => setCursor(d)} className={`relative mx-auto w-8 h-8 rounded-full text-[12px] ${sel ? "bg-gray-900 text-white font-semibold" : isSameMonth(d, cursor) ? "text-gray-800 hover:bg-gray-100" : "text-gray-300"} ${isToday(d) && !sel ? "ring-1 ring-gray-900" : ""}`}>
              {format(d, "d")}
              {hasEvents(d) && <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${sel ? "bg-[#A3F76B]" : "bg-gray-400"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- add menu ----------
function AddMenu({ onPlan, onJob }: { onPlan: () => void; onJob: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <LButton size="sm" icon={<Plus size={14} />} onClick={() => setOpen((v) => !v)}>Add <ChevronDown size={13} /></LButton>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-40 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl p-1.5">
            <button onClick={() => { setOpen(false); onPlan(); }} className="w-full text-left flex gap-3 rounded-xl p-3 hover:bg-gray-50">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-[#A3F76B] flex items-center justify-center"><Sparkles size={16} /></span>
              <span><span className="block text-sm font-semibold text-gray-900">Plan content</span><span className="block text-xs text-gray-500">AI fills your calendar with posts to review</span></span>
            </button>
            <button onClick={() => { setOpen(false); onJob(); }} className="w-full text-left flex gap-3 rounded-xl p-3 hover:bg-gray-50">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-gray-100 flex items-center justify-center"><Zap size={16} /></span>
              <span><span className="block text-sm font-semibold text-gray-900">New automation</span><span className="block text-xs text-gray-500">A post made and sent at set times, every day</span></span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CalendarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { requireAuth } = useAuthGate();
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(new Date());
  const [tab, setTab] = useState<Tab>(params.get("view") === "automations" ? "automations" : "posts");
  const [plans, setPlans] = useState<CalendarPlanItem[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [wizard, setWizard] = useState<{ brandId?: string; days?: number; brief?: string } | null>(null);
  const [jobWizard, setJobWizard] = useState(false);
  const [open, setOpen] = useState<Ev | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rangeStart = startOfWeek(startOfMonth(cursor));
  const rangeEnd = endOfWeek(endOfMonth(cursor));
  const monthKey = format(cursor, "yyyy-MM");

  const load = useCallback(() => {
    const q = `start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`;
    fetch(`/api/plans/items?${q}`).then((r) => r.json()).then((d) => d?.success && setPlans(d.data)).catch(() => {});
    fetch(`/api/calendar?${q}`).then((r) => r.json()).then((d) => d?.success && setPosts(d.data)).catch(() => {});
    fetch("/api/jobs").then((r) => r.json()).then((d) => d?.success && setJobs(d.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);
  useEffect(load, [load]);

  // Opened from chat ("plan my next 30 days") → /calendar?plan=1&days=30&brand=…
  useEffect(() => {
    if (params.get("plan") === "1") {
      setWizard({ brandId: params.get("brand") || undefined, days: Number(params.get("days")) || undefined, brief: params.get("brief") || undefined });
      router.replace("/calendar");
    }
  }, [params, router]);

  // ----- unify everything into events -----
  const events = useMemo<Ev[]>(() => {
    const out: Ev[] = [];
    const planned = new Set<string>();
    for (const p of plans) {
      out.push({ id: `plan:${p.id}`, kind: "plan", at: new Date(p.scheduledAt), title: p.theme || p.topic, sub: p.topic, family: familyOf(p.platform), status: p.status, format: p.format, raw: p });
      planned.add(p.id);
    }
    for (const p of posts) {
      if (!p.scheduledAt) continue;
      out.push({ id: `post:${p.id}`, kind: "post", at: new Date(p.scheduledAt), title: (p.caption || "Generated post").split("\n")[0].slice(0, 80), sub: p.caption || "", family: familyOf(p.platform), status: "made", raw: p });
    }
    const nowMs = Date.now();
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    for (const j of jobs.filter((x) => x.isActive)) {
      for (const d of days) {
        for (const at of occurrencesOn(j.schedule, d)) {
          if (+at > nowMs) out.push({ id: `auto:${j.id}:${+at}`, kind: "auto", at, title: j.name, sub: j.prompt, family: familyOf(j.platform), status: "auto", raw: j });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, posts, jobs, monthKey]);

  const families = useMemo(() => Array.from(new Set(events.map((e) => e.family))), [events]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => !hidden.includes(e.family) && (!q || `${e.title} ${e.sub} ${FAMILY_LABEL[e.family]}`.toLowerCase().includes(q)));
  }, [events, hidden, query]);

  const occasions = useMemo(() => occasionsBetween(rangeStart, rangeEnd), [monthKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasEvents = (d: Date) => visible.some((e) => isSameDay(e.at, d));

  const weekDays = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
  const draftCount = plans.filter((p) => p.status === "draft").length;

  const openEv = (e: Ev) => setOpen(e);
  const startPlan = () => requireAuth(() => setWizard({}));
  const startJob = () => requireAuth(() => setJobWizard(true));

  const step = (dir: 1 | -1) => setCursor(view === "month" ? addMonths(cursor, dir) : addDays(cursor, view === "week" ? 7 * dir : dir));
  const title = view === "month" ? format(cursor, "MMMM yyyy") : view === "week" ? `${format(weekDays[0], "d MMM")} – ${format(weekDays[6], "d MMM yyyy")}` : format(cursor, "EEEE, d MMMM yyyy");

  // ----- mobile pieces -----
  const mobileStrip = eachDayOfInterval({ start: addDays(cursor, -2), end: addDays(cursor, 2) });
  const dayEvents = visible.filter((e) => isSameDay(e.at, cursor)).sort((a, b) => +a.at - +b.at);
  const dayPosts = dayEvents.filter((e) => e.kind !== "auto");
  const dayAutos = dayEvents.filter((e) => e.kind === "auto");
  const activeJobs = jobs;

  return (
    <>
      
      <div className="px-4 sm:px-6 py-5 max-w-[1500px] mx-auto w-full">
        {params.get("posted") === "1" && <p className="mb-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm px-4 py-2.5">Nice, marked as posted.</p>}
        {draftCount > 0 && (
          <div className="mb-4 rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-2.5">
            {draftCount} draft post{draftCount === 1 ? "" : "s"} waiting for your review. Open one to edit it, or <button className="underline font-medium" onClick={startPlan}>review the plan</button>.
          </div>
        )}

        {/* ==================== DESKTOP ==================== */}
        <div className="hidden lg:flex gap-5 items-start">
          <aside className="w-[272px] shrink-0 space-y-4">
            <MiniMonth cursor={cursor} setCursor={setCursor} hasEvents={hasEvents} />

            <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[13px] font-semibold text-gray-900">Automations</p>
                <button onClick={startJob} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="New automation"><Plus size={15} /></button>
              </div>
              {jobs.length === 0 ? (
                <p className="text-xs text-gray-500 leading-relaxed">Recurring posts made and sent for you. <button className="underline text-gray-900" onClick={startJob}>Create one</button></p>
              ) : (
                <ul className="space-y-1">
                  {jobs.map((j) => (
                    <li key={j.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-gray-50">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setOpen({ id: `auto:${j.id}`, kind: "auto", at: new Date(), title: j.name, sub: j.prompt, family: familyOf(j.platform), status: "auto", raw: j })}>
                        <span className="block text-[13px] font-medium text-gray-900 truncate">{j.name}</span>
                        <span className="block text-[11px] text-gray-500">{parseSchedule(j.schedule).times.join(" · ")}</span>
                      </button>
                      <Toggle on={j.isActive} label={`Toggle ${j.name}`} onChange={(v) => { setJobs((cur) => cur.map((x) => (x.id === j.id ? { ...x, isActive: v } : x))); fetch(`/api/jobs/${j.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: v }) }).catch(() => {}); }} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {families.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
                <p className="text-[13px] font-semibold text-gray-900 mb-2">Platforms</p>
                <ul className="space-y-1">
                  {families.map((f) => (
                    <li key={f}>
                      <label className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" className="accent-gray-900" checked={!hidden.includes(f)} onChange={() => setHidden((h) => (h.includes(f) ? h.filter((x) => x !== f) : [...h, f]))} />
                        <span className={`w-2 h-2 rounded-full ${(TONE[f] || TONE.other).dot}`} />
                        <span className="text-[13px] text-gray-800">{FAMILY_LABEL[f]}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {occasions.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
                <p className="text-[13px] font-semibold text-gray-900 mb-2">Occasions</p>
                <ul className="space-y-1.5">
                  {occasions.filter((o) => o.date.startsWith(monthKey)).slice(0, 6).map((o) => (
                    <li key={o.date + o.name} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="text-gray-800 truncate">{o.name}</span>
                      <span className="text-gray-400 shrink-0">{format(new Date(o.date + "T12:00:00"), "d MMM")}</span>
                    </li>
                  ))}
                  {!occasions.some((o) => o.date.startsWith(monthKey)) && <li className="text-[12px] text-gray-400">Nothing this month</li>}
                </ul>
              </div>
            )}
          </aside>

          <section className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="inline-flex rounded-xl bg-gray-100 p-1">
                {(["day", "week", "month"] as View[]).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`px-4 h-8 rounded-lg text-[13px] font-medium capitalize ${view === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900"}`}>{v}</button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => step(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronLeft size={18} /></button>
                <button onClick={() => setCursor(new Date())} className="px-3 h-8 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-100">Today</button>
                <button onClick={() => step(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronRight size={18} /></button>
              </div>
              <p className="text-[15px] font-semibold text-gray-900">{title}</p>
              <div className="ml-auto flex items-center gap-2">
              <AddMenu onPlan={startPlan} onJob={startJob} />
              <label className="flex items-center gap-2 h-10 w-64 rounded-xl border border-gray-200 bg-white px-3 focus-within:border-gray-900">
                <Search size={15} className="text-gray-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts, automations…" className="flex-1 bg-transparent outline-none text-[13px] text-gray-900 placeholder:text-gray-400" />
              </label>
              </div>
            </div>
            {view === "month" ? (
              <MonthGrid cursor={cursor} events={visible} onOpen={openEv} onDay={(d) => { setCursor(d); setView("day"); }} />
            ) : (
              <TimeGrid days={view === "week" ? weekDays : [cursor]} events={visible} onOpen={openEv} />
            )}
          </section>
        </div>

        {/* ==================== MOBILE ==================== */}
        <div className="lg:hidden">
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-1.5">
                <button onClick={() => setCursor(addMonths(cursor, -1))} className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-600"><ChevronLeft size={16} /></button>
                <p className="flex-1 text-center text-[14px] font-medium text-gray-700">{format(cursor, "MMMM yyyy")}</p>
                <button onClick={() => setCursor(addMonths(cursor, 1))} className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-600"><ChevronRight size={16} /></button>
              </div>

              <div className="flex items-center gap-1.5">
                <button onClick={() => setCursor(addDays(cursor, -5))} className="w-8 h-8 shrink-0 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500"><ChevronLeft size={15} /></button>
                <div className="flex-1 grid grid-cols-5 gap-1">
                  {mobileStrip.map((d) => {
                    const sel = isSameDay(d, cursor);
                    return (
                      <button key={d.toISOString()} onClick={() => setCursor(d)} className={`rounded-2xl py-2.5 flex flex-col items-center gap-0.5 ${sel ? "bg-gray-900 text-white" : "text-gray-900"}`}>
                        <span className={`text-[12px] ${sel ? "text-white/80" : "text-gray-500"}`}>{format(d, "EEE")}</span>
                        <span className="text-[18px] font-semibold leading-none">{format(d, "dd")}</span>
                        <span className={`mt-0.5 w-1 h-1 rounded-full ${hasEvents(d) ? (sel ? "bg-[#A3F76B]" : "bg-gray-400") : "bg-transparent"}`} />
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setCursor(addDays(cursor, 5))} className="w-8 h-8 shrink-0 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500"><ChevronRight size={15} /></button>
              </div>

              <div className="flex items-center gap-2">
              <AddMenu onPlan={startPlan} onJob={startJob} />
              <label className="flex-1 flex items-center gap-2 h-11 rounded-xl border border-gray-200 bg-white px-3 focus-within:border-gray-900">
                <Search size={16} className="text-gray-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent outline-none text-[14px] text-gray-900 placeholder:text-gray-400" />
              </label>
              </div>
            </div>

            <div className="flex border-y border-gray-100">
              {([["posts", "Posts", CalendarDays], ["automations", "Automations", Zap], ["occasions", "Occasions", Megaphone]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => setTab(k)} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium border-b-2 ${tab === k ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500"}`}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3 bg-white">
              {tab === "posts" && (
                <>
                  {dayPosts.length === 0 && dayAutos.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-500">Nothing on {format(cursor, "EEEE d MMM")}.</p>
                      <LButton variant="secondary" size="sm" className="mt-3" icon={<Sparkles size={14} />} onClick={startPlan}>Plan content</LButton>
                    </div>
                  )}
                  {[...dayPosts, ...dayAutos].map((e) => {
                    const tone = TONE[e.family] || TONE.other;
                    const st = STATUS_STYLE[e.status];
                    const isOpen = expanded === e.id;
                    return (
                      <div key={e.id} className="rounded-2xl bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <button className="text-left min-w-0" onClick={() => openEv(e)}>
                            <p className="text-[15px] font-semibold text-gray-900 line-clamp-2">{e.title}</p>
                            <p className="mt-1 text-[13px] text-gray-500">{format(e.at, "h:mm a")}{e.format === "carousel" ? " · Carousel" : ""}</p>
                          </button>
                          <button onClick={() => setExpanded(isOpen ? null : e.id)} className="w-8 h-8 shrink-0 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500"><ChevronDown size={15} className={isOpen ? "rotate-180" : ""} /></button>
                        </div>
                        {isOpen && <p className="mt-2 text-[13px] text-gray-600 whitespace-pre-wrap line-clamp-6">{e.sub}</p>}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[13px] text-gray-500">{e.kind === "auto" ? "Automation" : FAMILY_LABEL[e.family]}</span>
                          <span className="flex items-center gap-1.5">
                            {st && <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${st.chip}`}>{st.label}</span>}
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium text-gray-800 ${tone.bg} border ${tone.bd}`}>{FAMILY_LABEL[e.family]}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {tab === "automations" && (
                <>
                  {activeJobs.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-500">No automations yet.</p>
                      <LButton variant="secondary" size="sm" className="mt-3" icon={<Zap size={14} />} onClick={startJob}>New automation</LButton>
                    </div>
                  )}
                  {activeJobs.map((j) => (
                    <div key={j.id} className="rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <button className="text-left min-w-0" onClick={() => setOpen({ id: `auto:${j.id}`, kind: "auto", at: new Date(), title: j.name, sub: j.prompt, family: familyOf(j.platform), status: "auto", raw: j })}>
                          <p className="text-[15px] font-semibold text-gray-900 truncate">{j.name}</p>
                          <p className="mt-1 text-[13px] text-gray-500">{parseSchedule(j.schedule).times.join(" · ")} daily</p>
                        </button>
                        <Toggle on={j.isActive} label={`Toggle ${j.name}`} onChange={(v) => { setJobs((cur) => cur.map((x) => (x.id === j.id ? { ...x, isActive: v } : x))); fetch(`/api/jobs/${j.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: v }) }).catch(() => {}); }} />
                      </div>
                      <div className="mt-3"><LBadge tone={j.isActive ? "success" : "neutral"}>{j.isActive ? "Running" : "Paused"}</LBadge></div>
                    </div>
                  ))}
                </>
              )}

              {tab === "occasions" && (
                <>
                  {occasions.filter((o) => o.date.startsWith(monthKey)).length === 0 && <p className="py-8 text-center text-sm text-gray-500">No occasions in {format(cursor, "MMMM")}.</p>}
                  {occasions.filter((o) => o.date.startsWith(monthKey)).map((o) => (
                    <div key={o.date + o.name} className="rounded-2xl bg-gray-50 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-gray-900 truncate">{o.name}</p>
                        <p className="mt-1 text-[13px] text-gray-500">{format(new Date(o.date + "T12:00:00"), "EEEE d MMM")}</p>
                      </div>
                      <LBadge tone={o.kind === "nigeria" ? "success" : o.kind === "retail" ? "warn" : "info"}>{o.kind === "nigeria" ? "Nigeria" : o.kind === "retail" ? "Sales" : "Global"}</LBadge>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {wizard && <PlanWizard initial={wizard} onClose={() => setWizard(null)} onChanged={load} />}
      {jobWizard && <JobWizard onClose={() => setJobWizard(false)} onCreated={load} />}
      {open?.kind === "plan" && <PlanItemModal item={open.raw as CalendarPlanItem} onClose={() => setOpen(null)} onChanged={load} />}
      {open?.kind === "post" && <PostModal post={open.raw as PostRow} onClose={() => setOpen(null)} />}
      {open?.kind === "auto" && <JobModal job={open.raw as JobRow} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarInner />
    </Suspense>
  );
}
