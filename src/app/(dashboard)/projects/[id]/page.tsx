// ============================================================
// UXLLY — Project Detail Page
// ============================================================

"use client";

import DashboardHeader from "@/components/layout/DashboardHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Sparkles, CalendarDays, Settings, Trash2 } from "lucide-react";
import Link from "next/link";

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      <DashboardHeader
        title="Project Details"
        subtitle={`Channel ID: ${params.id}`}
        onMenuClick={() => {}}
        actions={
          <Link href="/ai">
            <Button variant="primary" size="sm" icon={<Sparkles size={14} />}>
              Open in AI Studio
            </Button>
          </Link>
        }
      />
      <div className="uxlly-content">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <h3 className="text-base font-semibold text-ink-900 mb-4">Channel Overview</h3>
            <p className="text-sm text-ink-400">
              This page shows channel details, recent posts, and performance metrics.
              Connect your database to see real data.
            </p>
          </Card>
          <Card>
            <h3 className="text-base font-semibold text-ink-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/ai"><Button variant="secondary" size="sm" className="w-full justify-start" icon={<Sparkles size={14} />}>Generate Content</Button></Link>
              <Link href="/calendar"><Button variant="secondary" size="sm" className="w-full justify-start" icon={<CalendarDays size={14} />}>View Calendar</Button></Link>
              <Button variant="secondary" size="sm" className="w-full justify-start" icon={<Settings size={14} />}>Edit Style Guide</Button>
              <Button variant="danger" size="sm" className="w-full justify-start" icon={<Trash2 size={14} />}>Delete Channel</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
