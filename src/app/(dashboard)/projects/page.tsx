// ============================================================
// UXLLY — Projects (Channels) Page
// Grid of content channels with onboarding flow
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import OnboardingModal from "@/components/projects/OnboardingModal";
import {
  Plus,
  FolderKanban,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { formatRelative } from "@/lib/utils";

// ==================== Channel Type ====================
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

export default function ProjectsPage() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [loading, setLoading] = useState(true);

  // ==================== Fetch Projects ====================
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success) {
        setBrands(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Flatten brands → channels for the grid
  const channels = brands.flatMap((brand) =>
    brand.channels.map((ch) => ({
      ...ch,
      brandName: brand.name,
    }))
  );

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    fetchProjects(); // refresh after creating
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
            onClick={() => setShowOnboarding(true)}
          >
            New Project
          </Button>
        }
      />

      <div className="uxlly-content">
        {/* ==================== Loading State ==================== */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="uxlly-spinner w-8 h-8" />
          </div>
        )}

        {/* ==================== Empty State ==================== */}
        {!loading && channels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
              <FolderKanban size={28} className="text-ink-300" />
            </div>
            <h3 className="text-lg font-semibold text-ink-900 mb-1">
              No projects yet
            </h3>
            <p className="text-sm text-ink-400 max-w-sm mb-6">
              Create your first content channel. Set up your brand, choose a
              platform, and start generating content with AI.
            </p>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setShowOnboarding(true)}
            >
              Create your first project
            </Button>
          </div>
        )}

        {/* ==================== Projects Grid ==================== */}
        {!loading && channels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <Link key={channel.id} href={`/projects/${channel.id}`}>
                <Card interactive className="h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500">
                        <FolderKanban size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {channel.name}
                        </p>
                        <p className="text-xs text-ink-400">
                          {channel.brandName}
                        </p>
                      </div>
                    </div>
                    <Badge variant="neutral">{channel.platform}</Badge>
                  </div>

                  {channel.description && (
                    <p className="text-xs text-ink-400 mb-3">{channel.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-100">
                    <p className="text-xs text-ink-400">
                      {channel._count?.posts || 0} posts
                    </p>
                    <div className="flex items-center gap-1 text-xs text-ink-400">
                      <span>{formatRelative(channel.updatedAt)}</span>
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}

            {/* Add new card */}
            <Card
              interactive
              className="flex flex-col items-center justify-center py-8 border-dashed cursor-pointer"
              onClick={() => setShowOnboarding(true)}
            >
              <Plus size={24} className="text-ink-300 mb-2" />
              <p className="text-sm text-ink-500">Add channel</p>
            </Card>
          </div>
        )}
      </div>

      {/* ==================== Onboarding Modal ==================== */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={handleOnboardingClose}
      />
    </>
  );
}