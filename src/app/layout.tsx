// ============================================================
// UXLLY — Root Layout
// ============================================================

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/layout/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Uxlly — AI Content Automation",
  description:
    "Generate stunning social media graphics, copy, and campaigns with AI. Automate your content pipeline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Loads all fonts offered in the curated font picker (Settings +
            onboarding) so the live preview actually shows each font
            distinctly, instead of every option falling back to the same
            system font. Inter itself is loaded separately via next/font
            above for the app's own UI. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;600;700&family=Poppins:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Raleway:wght@400;600;700&family=Nunito:wght@400;600;700&family=Oswald:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&family=Fira+Sans:wght@400;600;700&family=Lato:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                borderRadius: "12px",
                background: "#18181B",
                color: "#FAFAFA",
                fontSize: "14px",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
