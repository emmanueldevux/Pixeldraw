"use client";

import { useState } from "react";

// --- MOCK DATA BASED ON SCREENSHOT ---
const CHARACTER_TYPES = [
  { id: "average", label: "Average", img: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mia" },
  { id: "bold", label: "Bold", img: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" },
  { id: "extreme", label: "Extreme", img: "https://api.dicebear.com/7.x/avataaars/svg?seed=John" },
  { id: "insect", label: "Insect", img: "https://api.dicebear.com/7.x/bottts/svg?seed=insect" },
  { id: "frog", label: "Frog", img: "https://api.dicebear.com/7.x/bottts/svg?seed=frog" },
  { id: "cat", label: "Cat", img: "https://api.dicebear.com/7.x/bottts/svg?seed=cat" },
];

export default function CarouselRightBar() {
  const [activeTab, setActiveTab] = useState("Create Influencer");
  const [selectedChar, setSelectedChar] = useState("extreme");

  return (
    <div className="w-[380px] shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden text-gray-900 font-sans">
      
      {/* SCROLLABLE CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        
        {/* Header Text */}
        <div className="text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">Create your own character with</p>
          <h2 className="text-2xl font-black uppercase tracking-wide text-gray-900">AI Influencer</h2>
        </div>

        {/* Custom Toggle Tabs (Matches Screenshot) */}
        <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200">
          {["Create Influencer", "Motion"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === tab 
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200/50" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Upload Box (Matches Screenshot) */}
        <div className="border border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center relative bg-gray-50 hover:bg-gray-100/50 transition-colors cursor-pointer group">
          <span className="absolute top-3 right-3 text-[10px] font-bold text-gray-500 bg-gray-200/60 px-2 py-1 rounded-md uppercase tracking-wider">
            Optional
          </span>
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mb-3 group-hover:bg-gray-300 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-gray-700">Upload your photo</span>
        </div>

        {/* Character Type Section (Matches Screenshot) */}
        <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 22h20L12 2zm0 3.8l6.5 13.2H5.5L12 5.8z"/>
              </svg>
              <h3 className="text-sm font-semibold text-gray-700">Character type · 9</h3>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
              </svg>
            </button>
          </div>

          {/* Character Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            {CHARACTER_TYPES.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedChar(char.id)}
                className={`relative flex flex-col items-center p-2 rounded-xl transition-all bg-white ${
                  selectedChar === char.id 
                    ? "border-2 border-[#CCFF00] shadow-sm" 
                    : "border border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 mb-2">
                  <img src={char.img} alt={char.label} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-medium text-gray-700">{char.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* FIXED BOTTOM ACTION BAR (Matches Screenshot) */}
      <div className="p-4 border-t border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          {/* Magic Wand Button */}
          <button className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors shrink-0">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </button>
          
          {/* Generate Button */}
          <button className="flex-1 h-12 bg-[#CCFF00] hover:bg-[#b3e600] text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors">
            Generate
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}