// ============================================================
// UXLLY — Platform Presets
// All supported social media sizes, formats, and metadata
// ============================================================

import type { PlatformPreset, PlatformKey } from "@/types";

export const PLATFORM_PRESETS: Record<PlatformKey, PlatformPreset> = {
  // ==================== Instagram ====================
  instagram_post: {
    key: "instagram_post",
    name: "Instagram Post",
    platform: "Instagram",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    icon: "instagram",
  },
  instagram_story: {
    key: "instagram_story",
    name: "Instagram Story",
    platform: "Instagram",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    icon: "instagram",
  },
  instagram_reel: {
    key: "instagram_reel",
    name: "Instagram Reel",
    platform: "Instagram",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    icon: "instagram",
  },

  // ==================== TikTok ====================
  tiktok: {
    key: "tiktok",
    name: "TikTok",
    platform: "TikTok",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    icon: "clapperboard",
  },

  // ==================== X / Twitter ====================
  twitter: {
    key: "twitter",
    name: "X / Twitter",
    platform: "Twitter",
    width: 1600,
    height: 900,
    aspectRatio: "16:9",
    icon: "twitter",
  },

  // ==================== LinkedIn ====================
  linkedin_post: {
    key: "linkedin_post",
    name: "LinkedIn Post",
    platform: "LinkedIn",
    width: 1200,
    height: 627,
    aspectRatio: "1.91:1",
    icon: "linkedin",
  },
  linkedin_carousel: {
    key: "linkedin_carousel",
    name: "LinkedIn Carousel",
    platform: "LinkedIn",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    icon: "linkedin",
  },

  // ==================== Facebook ====================
  facebook: {
    key: "facebook",
    name: "Facebook Post",
    platform: "Facebook",
    width: 1200,
    height: 630,
    aspectRatio: "1.91:1",
    icon: "facebook",
  },

  // ==================== YouTube ====================
  youtube_thumbnail: {
    key: "youtube_thumbnail",
    name: "YouTube Thumbnail",
    platform: "YouTube",
    width: 1280,
    height: 720,
    aspectRatio: "16:9",
    icon: "youtube",
  },

  // ==================== Pinterest ====================
  pinterest: {
    key: "pinterest",
    name: "Pinterest Pin",
    platform: "Pinterest",
    width: 1000,
    height: 1500,
    aspectRatio: "2:3",
    icon: "pin",
  },

  // ==================== Threads ====================
  threads: {
    key: "threads",
    name: "Threads",
    platform: "Threads",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    icon: "at-sign",
  },

  // ==================== Snapchat ====================
  snapchat: {
    key: "snapchat",
    name: "Snapchat",
    platform: "Snapchat",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    icon: "ghost",
  },
};

// ==================== Helpers ====================

export function getPlatformsByCategory(): Record<string, PlatformPreset[]> {
  const categories: Record<string, PlatformPreset[]> = {};

  for (const preset of Object.values(PLATFORM_PRESETS)) {
    if (!categories[preset.platform]) {
      categories[preset.platform] = [];
    }
    categories[preset.platform].push(preset);
  }

  return categories;
}

export function getPlatformPreset(key: PlatformKey): PlatformPreset {
  return PLATFORM_PRESETS[key];
}

export function getAllPlatformKeys(): PlatformKey[] {
  return Object.keys(PLATFORM_PRESETS) as PlatformKey[];
}
