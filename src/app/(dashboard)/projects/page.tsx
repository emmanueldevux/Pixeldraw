"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import Button from "@/components/ui/Button";
import OnboardingModal from "@/components/projects/OnboardingModal";
import { useAuthGate } from "@/components/auth/AuthGate";
import { Plus, FolderPlus, KeyRound, MoreHorizontal } from "lucide-react";
import Link from "next/link";

// ==================== Types ====================
interface ChannelData {
  id: string;
  name: string;
  platform: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { posts: number };
}

interface BrandData {
  id: string;
  name: string;
  channels: ChannelData[];
}

// ==================== Cover Patterns (light) ====================
// Each pattern = [bigTile, smallTop, smallBottom] shape classes
const SHAPE = "absolute bg-transparent border-[#E2E2E5]";
const FILL = "absolute bg-[#E2E2E5]";
const patterns: [string[], string, string][] = [
  [
    [`${SHAPE} w-[260px] h-[260px] -left-10 top-10 rounded-full border-[38px]`, `${SHAPE} w-[220px] h-[220px] -right-[90px] -top-[110px] rounded-full border-[38px]`],
    `${FILL} w-[120px] h-[120px] -right-[50px] -bottom-[60px] rounded-full`,
    `${FILL} w-[110px] h-[110px] left-[30px] -top-5 rounded-[30px_80px] rotate-[25deg]`,
  ],
  [
    [`${SHAPE} w-[300px] h-[300px] -right-[120px] -bottom-[150px] rounded-full border-[40px]`, `${FILL} w-[140px] h-[140px] -left-[50px] -top-[50px] rounded-full`],
    `${SHAPE} w-[130px] h-[130px] -left-[60px] -top-[50px] rounded-full border-[22px]`,
    `${FILL} w-[140px] h-[60px] -left-5 -bottom-2.5 rounded-[60px] -rotate-[20deg]`,
  ],
  [
    [`${SHAPE} w-[200px] h-[420px] left-[30px] -top-20 rounded-[120px] border-[36px] -rotate-[35deg]`],
    `${FILL} w-[90px] h-[90px] -right-[30px] -top-[30px] rounded-full`,
    `${SHAPE} w-[120px] h-[120px] -left-10 -bottom-[60px] rounded-full border-[20px]`,
  ],
];

export default function ProjectsPage() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { requireAuth } = useAuthGate();
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [loading, setLoading] = useState(true);

  // ==================== Fetch Projects ====================
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success) setBrands(data.data || []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const channels = brands.flatMap((brand) =>
    brand.channels.map((ch) => ({ ...ch, brandName: brand.name }))
  );

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    fetchProjects();
  };

  return (
    <>
      <DashboardHeader
        title="Projects"
        subtitle="Your content channels"
        onMenuClick={() => {}}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => requireAuth(() => setShowOnboarding(true))}
          >
            New Project
          </Button>
        }
      />

      <div className="flex-1 flex flex-col min-h-[calc(100vh-64px)] bg-[#F6F6F7]">
        {/* ==================== Loading ==================== */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="uxlly-spinner w-8 h-8" />
          </div>
        )}

        {/* ==================== Empty State ==================== */}
        {!loading && channels.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-full max-w-4xl rounded-2xl flex flex-col items-center py-12 px-4 mb-1 relative overflow-hidden">
              <div className="relative flex justify-center items-center w-full max-w-2xl h-[180px]">
                <div className="absolute left-0 md:left-12 w-[240px] md:w-[280px] h-[140px] md:h-[160px] rounded-xl overflow-hidden shadow-2xl -rotate-3 scale-95 opacity-90 translate-x-4 z-0 border border-gray-200">
                  <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=400&fit=crop" alt="Zephyr" className="w-full h-full object-cover" />
                </div>
                <div className="absolute right-0 md:right-12 w-[240px] md:w-[280px] h-[140px] md:h-[160px] rounded-xl overflow-hidden shadow-2xl rotate-3 scale-95 opacity-90 -translate-x-4 z-0 border border-gray-200">
                  <img src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=400&fit=crop" alt="Hell Grind" className="w-full h-full object-cover" />
                </div>
                <div className="relative w-[280px] md:w-[340px] h-[160px] md:h-[190px] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-10 border-2 border-gray-100">
                  <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=400&fit=crop" alt="The Chilly Hill Boys" className="w-full h-full object-cover" />
                </div>
              </div>
              <h1 className="mt-8 mb-3 text-2xl md:text-3xl font-extrabold text-gray-900 uppercase tracking-widest text-center drop-shadow-sm">
                Bring your stories to life
              </h1>
              <p className="text-[15px] text-gray-500 max-w-[400px] mb-8 leading-relaxed">
                Create your first content channel. Set up your brand, choose a platform, and start generating content with AI.
              </p>
              <button
                onClick={() => requireAuth(() => setShowOnboarding(true))}
                className="flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
              >
                <Plus size={18} />
                Create your first project
              </button>
            </div>
          </div>
        )}

        {/* ==================== Projects Grid ==================== */}
        {!loading && channels.length > 0 && (
          <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-6 gap-y-7">
              {/* ---- Create New Project ---- */}
              <button
                type="button"
                onClick={() => requireAuth(() => setShowOnboarding(true))}
                className="group flex flex-col gap-3.5 text-left"
              >
                <div className="relative aspect-video w-full rounded-[14px] bg-[#EFEFF1] border border-[#E3E3E6] flex items-center justify-center overflow-hidden transition-colors group-hover:bg-[#EAEAED]">
                  {/* floor shadow */}
                  <div className="absolute left-1/2 top-1/2 w-[150px] h-10 -translate-x-1/2 translate-y-10 rounded-full bg-black/[0.07] blur-[16px]" />
                  {/* 3D orb */}
                  <div className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center text-[#3F3F46] transition-transform duration-200 group-hover:scale-105 bg-[radial-gradient(circle_at_34%_24%,#FFFFFF_0%,#F7F7F8_38%,#E7E7EA_78%,#DCDCE0_100%)] shadow-[inset_0_1.5px_0_#FFFFFF,inset_0_-3px_6px_rgba(0,0,0,0.07),inset_0_0_0_1px_rgba(255,255,255,0.6),0_0_0_1px_rgba(0,0,0,0.06),0_3px_6px_rgba(0,0,0,0.08),0_14px_28px_-8px_rgba(0,0,0,0.22)]">
                    <div className="pointer-events-none absolute top-[5px] left-[14px] w-10 h-5 rounded-full bg-gradient-to-b from-white/95 to-white/0" />
                    <FolderPlus size={24} strokeWidth={1.6} className="relative drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]" />
                  </div>
                </div>
                <h3 className="px-1 text-[17px] font-semibold tracking-[-0.01em] text-[#18181B]">
                  Create new project
                </h3>
              </button>

              {/* ---- Existing Projects ---- */}
              {channels.map((channel, index) => {
                const [big, top, bottom] = patterns[index % patterns.length];
                return (
                  <Link
                    key={channel.id}
                    href={`/projects/${channel.id}`}
                    className="group flex flex-col gap-3.5"
                  >
                    <div className="relative aspect-video w-full grid grid-cols-[2.6fr_1fr] grid-rows-2 gap-2.5">
                      <div className="row-span-2 relative overflow-hidden rounded-[14px] bg-[#ECECEE] transition-colors group-hover:bg-[#E8E8EB]">
                        {big.map((cls, i) => <div key={i} className={cls} />)}
                      </div>
                      <div className="relative overflow-hidden rounded-[14px] bg-[#ECECEE] transition-colors group-hover:bg-[#E8E8EB]">
                        <div className={top} />
                      </div>
                      <div className="relative overflow-hidden rounded-[14px] bg-[#ECECEE] transition-colors group-hover:bg-[#E8E8EB]">
                        <div className={bottom} />
                      </div>

                      {/* hover menu */}
                      <div
                        onClick={(e) => e.preventDefault()}
                        className="absolute top-2.5 left-[calc(72.2%-46px)] w-[30px] h-[30px] rounded-[9px] flex items-center justify-center bg-gradient-to-b from-white to-[#F1F1F3] border border-[#E1E1E4] shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-[#52525B] hover:text-[#18181B] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal size={16} />
                      </div>
                    </div>

                    <div className="px-1 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#18181B] truncate">
                          {channel.name || "Untitled"}
                        </h3>
                        <p className="text-xs text-[#71717A] truncate mt-0.5">{channel.brandName}</p>
                      </div>
                      <div className="flex items-center gap-[5px] text-[13px] font-medium text-[#A1A1AA] shrink-0">
                        <KeyRound size={13} />
                        <span>Private</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <OnboardingModal isOpen={showOnboarding} onClose={handleOnboardingClose} />
    </>
  );
}
