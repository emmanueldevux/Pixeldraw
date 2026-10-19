// ============================================================
// UXLLY — Dashboard Overview Page
// Quick stats, recent activity, and shortcuts
// ============================================================

"use client";

import { useState } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  Sparkles,
  Image,
  CalendarDays,
  Zap,
  ArrowRight,
  Plus,
  TrendingUp,
  Layers,
  Video,
} from "lucide-react";
import Link from "next/link";
import { CarouselQuickModal, TikTokQuickModal } from "@/components/ai/QuickCreate";

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const [showTikTok, setShowTikTok] = useState(false);

  // ==================== Stats (placeholder data) ====================
  const stats = [
    {
      label: "Graphics Generated",
      value: "0",
      change: "+0 this week",
      icon: Image,
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      label: "Posts Scheduled",
      value: "0",
      change: "0 pending",
      icon: CalendarDays,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Active Jobs",
      value: "0",
      change: "0 runs today",
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      label: "AI Conversations",
      value: "0",
      change: "Start chatting",
      icon: Sparkles,
      color: "text-green-500",
      bg: "bg-green-50",
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Dashboard"
        subtitle="Welcome to Uxlly"
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="uxlly-content">
        {/* ==================== Stats Grid ==================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}
              >
                <stat.icon size={20} className={stat.color} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-ink-900">
                  {stat.value}
                </p>
                <p className="text-sm text-ink-500">{stat.label}</p>
                <p className="text-xs text-ink-400 mt-1">{stat.change}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* ==================== Quick Actions ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Start creating */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-ink-900">
                Quick Actions
              </h3>
              <Badge variant="brand">Get Started</Badge>
            </div>

            <div className="space-y-3">
              <Link href="/ai">
                <div className="flex items-center gap-4 p-3 rounded-xl border border-surface-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
                    <Sparkles size={18} className="text-brand-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      Open AI Studio
                    </p>
                    <p className="text-xs text-ink-400">
                      Chat with AI to generate graphics and copy
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-ink-300 group-hover:text-brand-500 transition-colors"
                  />
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setShowCarousel(true)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-4 p-3 rounded-xl border border-surface-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Layers size={18} className="text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900">Create Carousel</p>
                    <p className="text-xs text-ink-400">Plan and generate a multi-slide carousel</p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-ink-300 group-hover:text-brand-500 transition-colors"
                  />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowTikTok(true)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-4 p-3 rounded-xl border border-surface-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center">
                    <Video size={18} className="text-pink-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900">Create TikTok Slideshow</p>
                    <p className="text-xs text-ink-400">Hook, value slides, and close, with text you edit</p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-ink-300 group-hover:text-brand-500 transition-colors"
                  />
                </div>
              </button>

              <Link href="/projects">
                <div className="flex items-center gap-4 p-3 rounded-xl border border-surface-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <Plus size={18} className="text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      Create a Project
                    </p>
                    <p className="text-xs text-ink-400">
                      Set up a content channel with your brand style
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-ink-300 group-hover:text-brand-500 transition-colors"
                  />
                </div>
              </Link>

              <Link href="/jobs">
                <div className="flex items-center gap-4 p-3 rounded-xl border border-surface-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Zap size={18} className="text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      Schedule a Job
                    </p>
                    <p className="text-xs text-ink-400">
                      Auto-generate and deliver content on a schedule
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-ink-300 group-hover:text-brand-500 transition-colors"
                  />
                </div>
              </Link>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-ink-900">
                Recent Activity
              </h3>
              <TrendingUp size={16} className="text-ink-400" />
            </div>

            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mb-3">
                <Sparkles size={20} className="text-ink-300" />
              </div>
              <p className="text-sm text-ink-500 mb-1">No activity yet</p>
              <p className="text-xs text-ink-400">
                Create your first project to get started
              </p>
            </div>
          </Card>
        </div>
      </div>

      <CarouselQuickModal isOpen={showCarousel} onClose={() => setShowCarousel(false)} />
      <TikTokQuickModal isOpen={showTikTok} onClose={() => setShowTikTok(false)} />
    </>
  );
}
