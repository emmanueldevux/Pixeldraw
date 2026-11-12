// ============================================================
// UXLLY — Dashboard Overview Page
// Stats on top; Files/Projects on the left; quick action cards on the right (30%)
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { OnboardingReminder } from "@/components/onboarding/OnboardingProvider";
import LightCard from "@/components/ui/LightCard";
import Badge from "@/components/ui/Badge";
import {
  Sparkles,
  Image,
  CalendarDays,
  Zap,
  ArrowRight,
  Plus,
  Layers,
  Video,
  FolderKanban,
} from "lucide-react";
import Link from "next/link";
import { CarouselQuickModal } from "@/components/ai/QuickCreate";
import TikTokWizard from "@/components/ai/TikTokWizard";
import { formatRelative } from "@/lib/utils";

// ==================== Types ====================
interface DashboardChannel {
  id: string;
  name: string;
  platform: string;
  updatedAt: string;
  brandName: string;
  _count?: { posts: number };
}

interface GeneratedFile {
  id: string;
  url: string;
  label: string;
  count: number; // >1 = a carousel
}

type DashboardTab = "files" | "projects";

interface QuickAction {
  title: string;
  hint: string;
  icon: typeof Sparkles;
  tint: string;
  iconColor: string;
  href?: string;
  onClick?: () => void;
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const [showTikTok, setShowTikTok] = useState(false);
  const [tab, setTab] = useState<DashboardTab>("projects");
  const [channels, setChannels] = useState<DashboardChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  // Saved designs (single images, carousels, templates).
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  useEffect(() => {
    fetch("/api/generations?limit=60")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        setFiles(
          (d.data as { id: string; title: string; imageUrls: string[] }[])
            .filter((g) => g.imageUrls?.length)
            .map((g) => ({ id: g.id, url: g.imageUrls[0], label: g.title || "Design", count: g.imageUrls.length })),
        );
      })
      .catch(() => {});
  }, []);

  // ==================== Fetch projects ====================
  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success) {
        const flat: DashboardChannel[] = [];
        for (const brand of data.data || []) {
          for (const ch of brand.channels || []) {
            flat.push({ ...ch, brandName: brand.name });
          }
        }
        setChannels(flat);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // ==================== Stats (placeholder data) ====================
  const stats = [
    { label: "Graphics Generated", value: "0", change: "+0 this week", icon: Image, color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Posts Scheduled", value: "0", change: "0 pending", icon: CalendarDays, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Active Jobs", value: "0", change: "0 runs today", icon: Zap, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "AI Conversations", value: "0", change: "Start chatting", icon: Sparkles, color: "text-green-500", bg: "bg-green-50" },
  ];

  const quickActions: QuickAction[] = [
    {
      href: "/ai",
      title: "Open AI Studio",
      hint: "Chat with AI to generate graphics and copy",
      icon: Sparkles,
      tint: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      onClick: () => setShowCarousel(true),
      title: "Create Carousel",
      hint: "Plan and generate a multi-slide carousel",
      icon: Layers,
      tint: "bg-purple-50",
      iconColor: "text-purple-500",
    },
    {
      onClick: () => setShowTikTok(true),
      title: "Create TikTok Slideshow",
      hint: "Hook, value slides, and close, with text you edit",
      icon: Video,
      tint: "bg-pink-50",
      iconColor: "text-pink-500",
    },
    {
      href: "/projects",
      title: "Create a Project",
      hint: "Set up a content channel with your brand style",
      icon: Plus,
      tint: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      href: "/jobs",
      title: "Schedule a Job",
      hint: "Auto-generate and deliver content on a schedule",
      icon: Zap,
      tint: "bg-amber-50",
      iconColor: "text-amber-500",
    },
  ];

  // Each quick action is a card with its own background and generous padding.
  const quickCard = (a: QuickAction) => (
    <LightCard
      interactive
      padding="sm"
      className="group flex items-center gap-3 bg-gray-50 hover:bg-blue-50/40"
    >
      <div className={`w-9 h-9 rounded-lg ${a.tint} flex items-center justify-center shrink-0`}>
        <a.icon size={16} className={a.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{a.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{a.hint}</p>
      </div>
      <ArrowRight
        size={16}
        className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0"
      />
    </LightCard>
  );

  return (
    <>
      <DashboardHeader
        title="Dashboard"
        subtitle="Welcome to Uxlly"
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <OnboardingReminder />
      <div className="uxlly-content">
        {/* ==================== Stat cards ==================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <LightCard key={stat.label} className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon size={20} className={stat.color} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
              </div>
            </LightCard>
          ))}
        </div>

        {/* ==================== Projects / Files (left) + Quick actions (right, 30%) ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_30%] gap-6 items-start">
          {/* ---- Left: Files / Projects ---- */}
          <LightCard className="min-w-0">
            <div className="flex items-center gap-2 bg-gray-200/50 p-1 rounded-xl border border-gray-200 w-fit mb-4">
              {(
                [
                  { key: "files", label: "Files", icon: Image },
                  { key: "projects", label: "Projects", icon: FolderKanban },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === t.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* ---- Files: 4 per row ---- */}
            {tab === "files" &&
              (files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-gray-500 mb-1">No files yet</p>
                  <p className="text-xs text-gray-400">Generated images will show up here</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {files.map((f) => (
                    <LightCard key={f.id} padding="none" className="aspect-square overflow-hidden relative">
                      <img src={f.url} alt={f.label} className="w-full h-full object-cover" />
                      {f.count > 1 && (
                        <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">{f.count} slides</span>
                      )}
                    </LightCard>
                  ))}
                </div>
              ))}

            {/* ---- Projects: 3 per row ---- */}
            {tab === "projects" &&
              (channelsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="uxlly-spinner w-8 h-8" />
                </div>
              ) : channels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <FolderKanban size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">No projects yet</p>
                  <Link href="/projects" className="text-xs text-blue-600 hover:underline">
                    Create your first project
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {channels.map((channel) => (
                    <Link key={channel.id} href={`/projects/${channel.id}`}>
                      <LightCard interactive className="h-full">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                              <FolderKanban size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{channel.name}</p>
                              <p className="text-xs text-gray-400 truncate">{channel.brandName}</p>
                            </div>
                          </div>
                          <Badge variant="neutral">{channel.platform}</Badge>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-400">{channel._count?.posts || 0} posts</p>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <span>{formatRelative(channel.updatedAt)}</span>
                            <ArrowRight size={12} />
                          </div>
                        </div>
                      </LightCard>
                    </Link>
                  ))}
                </div>
              ))}
          </LightCard>

          {/* ---- Right: Quick actions ---- */}
          <div className="flex flex-col gap-3 rounded-xl bg-gray-100 border border-gray-200 p-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-semibold text-gray-900">Quick Actions</h3>
              <Badge variant="brand">Get Started</Badge>
            </div>

            {quickActions.map((a) =>
              a.href ? (
                <Link key={a.title} href={a.href}>
                  {quickCard(a)}
                </Link>
              ) : (
                <button key={a.title} type="button" onClick={a.onClick} className="w-full text-left">
                  {quickCard(a)}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <CarouselQuickModal isOpen={showCarousel} onClose={() => setShowCarousel(false)} />
      <TikTokWizard isOpen={showTikTok} onClose={() => setShowTikTok(false)} />
    </>
  );
}