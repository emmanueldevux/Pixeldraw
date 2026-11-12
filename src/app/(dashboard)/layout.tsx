// ============================================================
// UXLLY — Dashboard Layout
// Sidebar + main content area
// ============================================================

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PageLoader } from "@/components/layout/Preloader";
import { AuthGateProvider } from "@/components/auth/AuthGate";
import { BillingProvider } from "@/components/billing/BillingProvider";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
// Import the Light Sidebar from your home components folder
import { Sidebar } from "../home/components/Sidebar";
import { Suspense } from "react";
import AppHeader from "@/components/layout/AppHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Anonymous visitors can browse freely — gated actions (send a chat, create
  // a project or an automation) trigger the login popup via AuthGate instead.
  // Show loading while checking auth
  if (status === "loading") return <PageLoader />;

  return (
    <AuthGateProvider>
      <BillingProvider>
      <OnboardingProvider>
      {/* Use flex so the sidebar and main content sit side-by-side */}
      <div className="flex h-screen bg-[#FFFFFF] overflow-hidden">

        {/* Render the sidebar globally */}
        <Sidebar />

        {/* Main Content Area - flex-1 makes it take up the remaining space */}
        <main className="relative flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={null}><AppHeader /></Suspense>
          <div className="h-full overflow-y-auto pt-[72px]">
            {children}
          </div>
        </main>

      </div>
      </OnboardingProvider>
      </BillingProvider>
    </AuthGateProvider>
  );
}