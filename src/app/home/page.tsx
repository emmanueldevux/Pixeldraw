"use client";

import { useState } from "react";
import { MaterialSymbol } from "./icons";
import { Sidebar } from "./components/Sidebar";
import { HeroTitle } from "./components/HeroTitle";
import { PromptForm } from "./components/PromptForm";
import { GallerySection } from "./components/GallerySection";

export default function HomePage() {
  const [prompt, setPrompt] = useState("");

  const displayApps = [
    { slug: "1", title: "Aerial view", image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500&h=500&fit=crop" },
    { slug: "2", title: "Collector's tin", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&h=500&fit=crop" },
    { slug: "3", title: "‘80s flashback", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=500&h=500&fit=crop" },
  ];

  return (
    <div className="home-root bg-[#FFFFFF]">
      <Sidebar />

      <div className="home-layout-wrapper flex flex-col w-full">
        
        {/* Top Header - Light Theme */}
        <header className="h-16 border-b border-gray-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20 px-4 lg:px-8 flex items-center justify-between w-full shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-gray-500">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-gray-900 font-semibold">Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="home-content-scroller home-no-scrollbar flex-1">
          <div className="home-content-inner">
            <div className="home-content-relative">
              
              {/* Light Theme Settings Button */}
              <button type="button" aria-label="Page settings" className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <MaterialSymbol name="settings" style={{ fontSize: 20 }} />
              </button>

              <main className="home-main flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
                <HeroTitle />

                {/* 4 Cards - Light Theme */}
                <div 
                  className="w-full max-w-[52rem] mt-10 mb-8 grid gap-3"
                  style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
                >
                  <div className="aspect-square rounded-xl bg-white flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors border border-gray-200">
                    <span className="text-2xl text-gray-400 font-light mb-1">+</span>
                    <span className="text-[10px] font-medium text-gray-600">Upload</span>
                  </div>

                  {displayApps.map((app) => (
                    <div 
                      key={app.slug} 
                      className="aspect-square rounded-xl overflow-hidden relative cursor-pointer border border-gray-200 bg-gray-100"
                    >
                      <img src={app.image} alt={app.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                      <span className="absolute bottom-2 left-3 right-3 text-[10px] font-semibold text-white truncate">
                        {app.title}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="w-full max-w-[52rem]">
                  <PromptForm value={prompt} onChange={setPrompt} />
                </div>
              </main>

              <div className="w-full max-w-5xl mx-auto px-4 pb-20">
                <GallerySection />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}