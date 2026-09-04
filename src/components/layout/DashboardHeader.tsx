// ============================================================
// UXLLY — Dashboard Page Header
// Top bar with page title, search, and actions
// ============================================================

"use client";

import { Menu, Search, Bell } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  actions?: React.ReactNode;
}

export default function DashboardHeader({
  title,
  subtitle,
  onMenuClick,
  actions,
}: DashboardHeaderProps) {
  return (
    <header className="uxlly-page-header">
      {/* ==================== Left: Menu + Title ==================== */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-surface-100 text-ink-500 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
          {subtitle && (
            <p className="text-xs text-ink-400">{subtitle}</p>
          )}
        </div>
      </div>

      {/* ==================== Right: Search + Actions ==================== */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface-100 border border-surface-200 rounded-lg">
          <Search size={14} className="text-ink-400" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-ink-800 placeholder:text-ink-400 outline-none w-48"
          />
        </div>

        {/* Notifications */}
        <button className="p-2 rounded-lg hover:bg-surface-100 text-ink-500 relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Extra actions */}
        {actions}
      </div>
    </header>
  );
}
