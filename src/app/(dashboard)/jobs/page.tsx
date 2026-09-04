// ============================================================
// UXLLY — Scheduled Jobs Page
// ============================================================

"use client";

import { useState } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Zap, Play, Pause, Trash2 } from "lucide-react";
import { PLATFORM_PRESETS } from "@/lib/platforms";

export default function JobsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const jobs: Array<{
    id: string; name: string; platform: string; schedule: string;
    isActive: boolean; lastRunAt: string | null;
  }> = [];

  const platformOptions = Object.values(PLATFORM_PRESETS).map((p) => ({
    value: p.key, label: p.name,
  }));

  return (
    <>
      <DashboardHeader
        title="Jobs"
        subtitle="Automated content generation"
        onMenuClick={() => {}}
        actions={
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
            New Job
          </Button>
        }
      />

      <div className="uxlly-content">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
              <Zap size={28} className="text-ink-300" />
            </div>
            <h3 className="text-lg font-semibold text-ink-900 mb-1">No jobs yet</h3>
            <p className="text-sm text-ink-400 max-w-sm mb-6">
              Create a scheduled job to auto-generate and deliver content 2x/day.
              Jobs run on a schedule and deliver via email, Telegram, or direct post.
            </p>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>
              Create your first job
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{job.name}</p>
                    <p className="text-xs text-ink-400">{job.schedule}</p>
                  </div>
                  <Badge variant={job.isActive ? "success" : "neutral"}>
                    {job.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button variant="ghost" size="sm" icon={job.isActive ? <Pause size={12} /> : <Play size={12} />}>
                    {job.isActive ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="danger" size="sm" icon={<Trash2 size={12} />}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ==================== Create Job Modal ==================== */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Job" size="md">
        <div className="space-y-4">
          <Input label="Job Name" placeholder="e.g. Morning Instagram Post" />
          <Select label="Platform" options={platformOptions} />
          <div>
            <label className="text-sm font-medium text-ink-800 mb-1.5 block">Generation Prompt</label>
            <textarea className="uxlly-input min-h-[100px] resize-y" placeholder="Describe what content to generate each run..." rows={4} />
          </div>
          <Input label="Schedule" placeholder="09:00,17:00" hint="Comma-separated times (24h format)" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary">Create Job</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
