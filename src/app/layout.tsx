import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/layout/AuthProvider";
import Preloader, { preloaderGuard } from "@/components/layout/Preloader";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });

// Loading Helvetica Now Display
// The path starts with "./" because it's relative to src/app/layout.tsx
const helveticaNow = localFont({
  src: [
    {
      path: "./home/components/fonts/HelveticaNowDisplay-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./home/components/fonts/HelveticaNowDisplay-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./home/components/fonts/HelveticaNowDisplay-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./home/components/fonts/HelveticaNowDisplay-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-helvetica",
});

export const metadata: Metadata = {
  title: "Uxlly — AI Content Automation",
  description:
    "Generate stunning social media graphics, copy, and campaigns with AI. Automate your content pipeline.",
  icons: {
    icon: [
      { url: "/templates/images/favicon%201.png", sizes: "32x32", type: "image/png" },
      { url: "/templates/images/favicon%201.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/templates/images/favicon%201.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${helveticaNow.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preloaderGuard }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;600;700&family=Poppins:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Raleway:wght@400;600;700&family=Nunito:wght@400;600;700&family=Oswald:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&family=Fira+Sans:wght@400;600;700&family=Lato:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* Setting the body className to helveticaNow.className applies it globally */}
      <body className={`${helveticaNow.className} antialiased`}>
        <Preloader />
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                borderRadius: "12px",
                background: "#252525",
                color: "#FCFCFC",
                border: "1px solid #333333",
                fontSize: "14px",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}