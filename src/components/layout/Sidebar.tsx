// ============================================================
// UXLLY — Sidebar Navigation
// Left sidebar with all main navigation items
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  FolderKanban,
  CalendarDays,
  Zap,
  Settings,
  LayoutDashboard,
  ChevronLeft,
  LogOut,
  Sparkles,
  Palette,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// ==================== Navigation Items ====================

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "AI Studio",
    href: "/ai",
    icon: Sparkles,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    label: "Inspiration",
    href: "/inspiration",
    icon: Palette,
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    label: "Jobs",
    href: "/jobs",
    icon: Zap,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function Sidebar({ isOpen, onClose, user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* ==================== Mobile Overlay ==================== */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ==================== Sidebar Panel ==================== */}
      <aside
        className={cn(
          "uxlly-sidebar",
          isOpen && "sidebar-open"
        )}
      >
        {/* ==================== Logo & Close ==================== */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-lg font-semibold text-ink-900">Uxlly</span>
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-100 text-ink-400 lg:hidden"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* ==================== Nav Items ==================== */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-600"
                    : "text-ink-500 hover:bg-surface-100 hover:text-ink-800"
                )}
              >
                <item.icon
                  size={18}
                  className={cn(
                    isActive ? "text-brand-500" : "text-ink-400"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ==================== User Profile ==================== */}
        <div className="border-t border-surface-200 p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar
              src={user?.image}
              name={user?.name}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900 truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-ink-400 truncate">
                {user?.email || ""}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1.5 rounded-lg hover:bg-surface-100 text-ink-400 hover:text-red-500 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
