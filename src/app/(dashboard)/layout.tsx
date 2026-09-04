// ============================================================
// UXLLY — Dashboard Layout
// Sidebar + main content area
// ============================================================

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  if (status === "unauthenticated") {
    redirect("/login");
  }

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="uxlly-spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={session?.user}
      />
      <main className="uxlly-main-area">
        {/* Pass sidebar toggle to children via context or props */}
        <div className="flex flex-col min-h-screen">
          {/* Mobile menu trigger is in DashboardHeader */}
          {children}
        </div>
      </main>
    </div>
  );
}
