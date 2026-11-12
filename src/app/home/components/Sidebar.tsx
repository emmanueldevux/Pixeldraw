"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useBilling } from "@/components/billing/BillingProvider";
import { formatCredits } from "@/lib/billing/units";
import { NAV_GROUPS, ICON_ACTIONS } from "../data";

// Raw SVG Icons (Querro Style) - Slightly larger sizes
const Icons = {
  templates: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  dashboard: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z" />
    </svg>
  ),
  free_tools: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  projects: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  ),
  calendar: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  brain: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M9.5 3a3 3 0 00-3 3 3 3 0 00-2.5 4.5A3 3 0 005 15a3 3 0 003 3.5V21M14.5 3a3 3 0 013 3 3 3 0 012.5 4.5A3 3 0 0119 15a3 3 0 01-3 3.5V21M12 3v18" />
    </svg>
  ),
  jobs: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18" />
    </svg>
  ),
  pricing: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </svg>
  ),
  settings: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  link: (
    <svg className="w-[18px] h-[18px] text-gray-500 group-hover:text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  menu_open: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M9 3v18" />
    </svg>
  ),
  notifications: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.66V5a2 2 0 10-4 0v.34C7.67 6.17 6 8.39 6 11v3.2c0 .53-.21 1.05-.6 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  chevron_right: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
};

// Maps your labels to the raw SVGs
const getIcon = (label: string) => {
  const map: Record<string, keyof typeof Icons> = {
    "Dashboard": "dashboard",
    "Templates": "templates",
    "Free tools": "free_tools",
    "My projects": "projects",
    "Brand brain": "brain",
    "Calendar": "calendar",
    "Jobs": "jobs",
    "Pricing": "pricing",
    "Settings": "settings",
  };
  return Icons[map[label]] || Icons.settings;
};

// A link is active on its exact path or any sub-path (e.g. /projects/abc).
const isPathActive = (pathname: string, href: string) =>
  pathname === href.split("?")[0] || pathname.startsWith(href.split("?")[0] + "/");

export function Sidebar() {
  const { data: session } = useSession();
  const billing = useBilling();
  const pathname = usePathname();
  const email = session?.user?.email || "Loading…";

  return (
    <aside
      className="hidden lg:flex lg:w-64 shrink-0 bg-[#FFFFFF] border-r border-gray-200/80 flex-col justify-between h-screen sticky top-0 px-3.5 py-4 select-none z-30 font-[family-name:var(--font-helvetica)]"
    >
      {/* Top Section */}
      <div className="flex flex-col gap-4">
        {/* Logo & Toggle Header */}
        <div className="px-2 pt-1 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2">
            <Image
              src="/templates/images/makesocial-logo.png"
              alt="MakeSocial"
              width={128}
              height={32}
              priority
              className="h-[21px] w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            aria-label="Collapse navigation"
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            {Icons.menu_open}
          </button>
        </div>

        {/* Connect Website Button */}
        <div className="px-1 pt-1">
          <Link
            href="/chat"
            className="group relative flex items-center justify-center gap-2 w-full p-[1px] rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 shadow-2xs transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-center gap-2 w-full h-full py-[0.7rem] px-3 bg-white group-hover:bg-gray-50/90 rounded-[11px] transition-colors">
              <span className="text-sm font-semibold text-gray-800">New Chat</span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-4 px-1">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.title || `group-${groupIndex}`} className="flex flex-col gap-0.5">
              {group.title && (
                <div
                  className="px-2 pb-1 font-bold uppercase tracking-wider text-gray-400"
                  style={{ fontSize: "0.65rem", lineHeight: "1rem" }}
                >
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const href = item.label === "Templates" ? "/templates" : item.href;
                const active = item.active ?? isPathActive(pathname, href);
                return (
                  <Link
                    key={item.label}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-sm font-medium transition-colors border-[2px] ${
                      active
                        ? "bg-gray-200/70 text-gray-900 border-black"
                        : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900 border-transparent"
                    }`}
                  >
                    <span className={active ? "text-gray-900" : "text-gray-500"}>
                      {getIcon(item.label)}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.hasSubmenu && (
                      <span className="text-gray-400">{Icons.chevron_right}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col gap-3">
        {/* Credits / plan card */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">
              {billing.overview ? (billing.overview.plan ? `${billing.overview.plan.name} plan` : "Pay as you go") : "Credits"}
            </span>
            <span className="text-xs text-gray-500 font-semibold">
              {billing.overview ? `${formatCredits(Math.max(0, billing.overview.balanceMilli))} credits` : ""}
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-snug">
            {billing.overview?.free.available
              ? `Free trial: ${Math.max(0, billing.overview.free.cap - billing.overview.free.usedTotal)} free image(s) left.`
              : "Top up any time, or pick a monthly plan for better value."}
          </p>
          {billing.overview ? (
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => billing.openTopUp()}
                className="flex-1 py-2.5 bg-[#2B2B2B] hover:bg-black text-white text-sm font-semibold rounded-lg text-center transition-colors"
              >
                Buy credits
              </button>
              <Link
                href="/billing"
                className="px-3 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-sm font-semibold rounded-lg text-center transition-colors"
              >
                Billing
              </Link>
            </div>
          ) : (
            <Link
              href="/billing"
              className="mt-1 w-full py-2.5 bg-[#2B2B2B] hover:bg-black text-white text-sm font-semibold rounded-lg text-center transition-colors"
            >
              Plans &amp; credits
            </Link>
          )}
        </div>

        {/* Account card */}
        <div className="flex items-center justify-between p-2 rounded-xl border-2 border-gray-200/60 hover:bg-gray-200/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-amber-700 text-white font-medium flex items-center justify-center text-sm shrink-0 overflow-hidden">
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
              ) : (
                <span>{email.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {session?.user?.name || "User"}
              </span>
              <span className="text-xs text-gray-500 truncate">{email}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}