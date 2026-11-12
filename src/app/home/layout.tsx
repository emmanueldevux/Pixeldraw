// ============================================================
// UXLLY — /home nested layout
// Kept separate from the root layout on purpose — Next.js only allows
// one root <html>/<body> per app, and this page uses its own font
// (Inter Tight) and its own plain-CSS design system that shouldn't
// bleed into the rest of the dashboard.
// ============================================================

import { Inter_Tight } from "next/font/google";
// Next.js bundles this stylesheet, but the project has no CSS module declaration.
// @ts-ignore -- intentional side-effect import of a global stylesheet
import "./home.css";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";

const interTight = Inter_Tight({
  variable: "--home-font-heading-var",
  subsets: ["latin"],
  display: "swap",
});

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={interTight.variable}
      style={{
        // Exposes the loaded heading font to home.css's var() reference,
        // without needing to touch the app's root layout/body at all.
        ["--home-font-heading" as string]: `var(--home-font-heading-var), "Inter Tight", Inter, sans-serif`,
      }}
    >
      {/* Material Symbols Outlined — loaded from Google's hosted stylesheet
          since no local .woff2 file was provided to self-host. Renders
          identically as ligature-text icons either way. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
      />
      {/* Onboarding questions for brand-new users who land on /home first */}
      <OnboardingProvider>{children}</OnboardingProvider>
    </div>
  );
}