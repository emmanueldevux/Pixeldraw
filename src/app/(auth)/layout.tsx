// ============================================================
// UXLLY — Auth Layout (Login / Signup)
// Clean centered layout with no sidebar
// ============================================================

import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-4">
      {/* ==================== Logo ==================== */}
      <Link
        href="/"
        className="flex items-center gap-2.5 mb-8"
      >
        <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
          <Sparkles size={22} className="text-white" />
        </div>
        <span className="text-2xl font-bold text-ink-900">Uxlly</span>
      </Link>

      {/* ==================== Auth Card ==================== */}
      {children}
    </div>
  );
}
