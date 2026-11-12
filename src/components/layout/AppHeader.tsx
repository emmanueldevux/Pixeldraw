// ============================================================
// UXLLY — Unified app header (one bar for every page)
//   left : Create project ▾ (make ads / carousels / slideshows / thumbnails)
//          Chat history ▾ (recent projects and chats)
//   right: Search · Credits · Notifications (bell last)
// Light glass; page content scrolls underneath it.
// ============================================================
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, ChevronDown, FolderPlus, History, Image as ImageIcon, LayoutGrid, MessageSquare, Plus, Search, Images, Smartphone, X } from "lucide-react";
import { CreditsPill } from "@/components/billing/CreditsPill";
import { useAuthGate } from "@/components/auth/AuthGate";
import OnboardingModal from "@/components/projects/OnboardingModal";

type Recent = { id: string; name: string; sub: string; href: string; at: string };

const MAKE = [
  { label: "Make ads", hint: "One scroll-stopping ad", icon: ImageIcon, prompt: "Make an ad for " },
  { label: "Make carousels", hint: "Swipeable multi-slide posts", icon: LayoutGrid, prompt: "Make a carousel about " },
  { label: "Make slideshows", hint: "TikTok photo slideshows", icon: Smartphone, prompt: "Make a tiktok slideshow about " },
  { label: "Make thumbnails", hint: "YouTube thumbnails", icon: Images, prompt: "Make a YouTube thumbnail for " },
];

function Menu({ open, onClose, children, className = "" }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute left-0 top-full mt-2 z-50 rounded-2xl border border-white/70 bg-white/80 backdrop-blur-2xl shadow-[0_16px_48px_rgba(15,23,42,0.14)] p-1.5 ${className}`}>{children}</div>
    </>
  );
}

const soft = "bg-[rgb(229_231_235/9%)] border border-gray-200 text-gray-800 hover:bg-gray-100/60";
const btn = "inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium transition-colors";
const tabOn = `${btn} bg-gray-900 text-white hover:bg-black border border-gray-900`;
const tabOff = `${btn} ${soft}`;

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { status } = useSession();
  const { requireAuth } = useAuthGate();

  const [menu, setMenu] = useState<null | "create" | "history" | "bell">(null);
  const [recent, setRecent] = useState<Recent[] | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [q, setQ] = useState("");
  const loadedFor = useRef<string | null>(null);

  // Keep the box in step with /templates?q=
  useEffect(() => {
    if (pathname === "/templates") setQ(params?.get("q") || "");
  }, [pathname, params]);

  useEffect(() => {
    if (menu !== "history" || status !== "authenticated" || loadedFor.current === "done") return;
    loadedFor.current = "done";
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const rows: Recent[] = (d.data || []).map((b: { id: string; name: string; updatedAt: string; channels?: { id: string; platform: string }[] }) => {
          const ch = b.channels?.[0];
          return { id: b.id, name: b.name, sub: ch ? ch.platform.replace(/_/g, " ") : "project", href: ch ? `/ai?channel=${ch.id}` : "/projects", at: b.updatedAt };
        });
        setRecent(rows);
      })
      .catch(() => setRecent([]));
  }, [menu, status]);

  const go = (href: string) => {
    setMenu(null);
    router.push(href);
  };

  const makeThing = (prompt: string) => go(`/ai?prompt=${encodeURIComponent(prompt)}`);

  const submitSearch = () => {
    const t = q.trim();
    router.push(t ? `/templates?q=${encodeURIComponent(t)}` : "/templates");
  };

  return (
    <>
      <header className="absolute top-0 inset-x-0 z-40 h-[67px] flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-gray-300 bg-gradient-to-b from-white/70 to-white/35 backdrop-blur-2xl backdrop-saturate-150">
        {/* ---------- left ---------- */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <button
              onClick={() => setMenu(menu === "create" ? null : "create")}
              className={tabOn}
            >
              <Plus size={15} /> <span className="hidden sm:inline">Create project</span> <ChevronDown size={14} className="opacity-70" />
            </button>
            <Menu open={menu === "create"} onClose={() => setMenu(null)} className="w-72">
              <button
                onClick={() => { setMenu(null); requireAuth(() => setOnboarding(true)); }}
                className="w-full text-left flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50"
              >
                <span className="w-9 h-9 shrink-0 rounded-xl bg-[#A3F76B] flex items-center justify-center"><FolderPlus size={16} /></span>
                <span><span className="block text-sm font-semibold text-gray-900">New project</span><span className="block text-xs text-gray-500">Set up a brand and start creating</span></span>
              </button>
              <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Start making</p>
              {MAKE.map((m) => (
                <button key={m.label} onClick={() => makeThing(m.prompt)} className="w-full text-left flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-gray-100 flex items-center justify-center"><m.icon size={16} /></span>
                  <span><span className="block text-sm font-semibold text-gray-900">{m.label}</span><span className="block text-xs text-gray-500">{m.hint}</span></span>
                </button>
              ))}
            </Menu>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenu(menu === "history" ? null : "history")}
              className={tabOff}
            >
              <History size={15} /> <span className="hidden sm:inline">Chat history</span> <ChevronDown size={14} className="text-gray-400" />
            </button>
            <Menu open={menu === "history"} onClose={() => setMenu(null)} className="w-80 max-h-96 overflow-y-auto">
              <button onClick={() => go("/chat")} className="w-full text-left flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center"><MessageSquare size={15} /></span>
                <span className="text-sm font-semibold text-gray-900">New free chat</span>
              </button>
              <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Recent projects</p>
              {status !== "authenticated" ? (
                <p className="px-2.5 py-3 text-xs text-gray-500">Sign in to see your projects and chats.</p>
              ) : recent === null ? (
                <p className="px-2.5 py-3 text-xs text-gray-400">Loading…</p>
              ) : recent.length === 0 ? (
                <p className="px-2.5 py-3 text-xs text-gray-500">No projects yet. Create one to start.</p>
              ) : (
                recent.slice(0, 12).map((r) => (
                  <button key={r.id} onClick={() => go(r.href)} className="w-full text-left flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 hover:bg-gray-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{r.name}</span>
                      <span className="block text-[11px] text-gray-500 capitalize">{r.sub}</span>
                    </span>
                    <span className="text-[11px] text-gray-400 shrink-0">{new Date(r.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                  </button>
                ))
              )}
              <Link href="/projects" onClick={() => setMenu(null)} className="block mt-1 px-2.5 py-2 text-xs font-medium text-gray-600 hover:text-gray-900">All projects →</Link>
            </Menu>
          </div>
        </div>

        {/* ---------- right: search · credits · bell ---------- */}
        <div className="flex items-center gap-2.5 shrink-0">
          <label className="hidden md:flex items-center gap-2 h-10 w-56 lg:w-72 rounded-xl border-2 border-gray-300 bg-[rgb(229_231_235/9%)] px-3.5 focus-within:border-gray-900">
            <Search size={15} className="text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder="Search templates…"
              className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
            />
            {q && <button type="button" onClick={() => setQ("")} className="text-gray-400 hover:text-gray-700"><X size={14} /></button>}
          </label>

          <CreditsPill className="!h-10 !rounded-xl !px-4 !bg-[rgb(229_231_235/9%)] hover:!bg-gray-100/60" />

          <div className="relative">
            <button onClick={() => setMenu(menu === "bell" ? null : "bell")} aria-label="Notifications" className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 ${soft}`}>
              <Bell size={16} />
            </button>
            {menu === "bell" && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl p-4">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  <p className="mt-1 text-xs text-gray-500">You&apos;re all caught up.</p>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <OnboardingModal isOpen={onboarding} onClose={() => { setOnboarding(false); router.refresh(); loadedFor.current = null; setRecent(null); }} />
    </>
  );
}
