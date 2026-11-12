// ============================================================
// UXLLY — Format catalogue for the size cards
// Sizes checked against current (2026) platform guidance: 4:5 portrait
// (1080×1350) is the default feed size on Instagram, Facebook and LinkedIn;
// 9:16 for stories/reels/TikTok; 1.91:1 for link-style posts; 16:9 for X and
// YouTube; 2:3 for Pinterest.
// ============================================================
import type { PlatformKey } from "@/types";

export interface FormatCard {
  key: PlatformKey;
  platform: string; // group heading
  name: string; // "Portrait post"
  hint: string; // one line, plain words
  w: number;
  h: number;
  ratio: string;
  recommended?: boolean;
}

export const FORMAT_CARDS: FormatCard[] = [
  { key: "instagram_portrait", platform: "Instagram", name: "Feed post", hint: "Portrait: the most space in the feed", w: 1080, h: 1350, ratio: "4:5", recommended: true },
  { key: "instagram_post", platform: "Instagram", name: "Square post", hint: "Classic square", w: 1080, h: 1080, ratio: "1:1" },
  { key: "instagram_story", platform: "Instagram", name: "Story", hint: "Full-screen vertical", w: 1080, h: 1920, ratio: "9:16" },
  { key: "instagram_reel", platform: "Instagram", name: "Reel cover", hint: "Full-screen vertical", w: 1080, h: 1920, ratio: "9:16" },

  { key: "facebook_portrait", platform: "Facebook", name: "Feed post", hint: "Portrait: the most space in the feed", w: 1080, h: 1350, ratio: "4:5", recommended: true },
  { key: "facebook", platform: "Facebook", name: "Link / landscape post", hint: "Wide, for links and shares", w: 1200, h: 630, ratio: "1.91:1" },

  { key: "linkedin_portrait", platform: "LinkedIn", name: "Feed post", hint: "Portrait: stands out in the feed", w: 1080, h: 1350, ratio: "4:5", recommended: true },
  { key: "linkedin_post", platform: "LinkedIn", name: "Landscape post", hint: "Wide, for links and shares", w: 1200, h: 627, ratio: "1.91:1" },
  { key: "linkedin_carousel", platform: "LinkedIn", name: "Square post", hint: "Square image or document slide", w: 1080, h: 1080, ratio: "1:1" },

  { key: "tiktok", platform: "TikTok", name: "Photo / slideshow", hint: "Full-screen vertical", w: 1080, h: 1920, ratio: "9:16", recommended: true },
  { key: "twitter", platform: "X (Twitter)", name: "Post image", hint: "Wide, shows fully in the timeline", w: 1600, h: 900, ratio: "16:9", recommended: true },
  { key: "pinterest", platform: "Pinterest", name: "Pin", hint: "Tall pins get the most room", w: 1000, h: 1500, ratio: "2:3", recommended: true },
  { key: "youtube_thumbnail", platform: "YouTube", name: "Thumbnail", hint: "Wide, 16:9", w: 1280, h: 720, ratio: "16:9", recommended: true },
  { key: "threads", platform: "Threads", name: "Post image", hint: "Square", w: 1080, h: 1080, ratio: "1:1", recommended: true },
  { key: "snapchat", platform: "Snapchat", name: "Snap", hint: "Full-screen vertical", w: 1080, h: 1920, ratio: "9:16", recommended: true },
];

export const FORMAT_PLATFORMS = Array.from(new Set(FORMAT_CARDS.map((c) => c.platform)));

export const cardFor = (key: string) => FORMAT_CARDS.find((c) => c.key === key);
