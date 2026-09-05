// ============================================================
// UXLLY — Type Definitions
// ============================================================

// ==================== AI Provider Types ====================

export type AIProvider = "deepseek" | "openai" | "anthropic";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ImageGenerationRequest {
  prompt: string;
  size: ImageSize;
  style?: "natural" | "vivid";
quality?: "low" | "medium" | "high" | "auto";
  platform?: string; // used to match the inspiration injection pool
}

// ==================== Inspiration Library Types ====================

export interface InspirationImageData {
  id: string;
  url: string;
  platform?: string | null;
  style?: string | null;
  mood?: string | null;
  industry?: string | null;
  tags: string[];
  createdAt: string | Date;
}

export interface ImageGenerationResponse {
  url: string;
  revisedPrompt?: string;
  compositionText?: string; // internal — lets logo placement react to where the main content sits
}

// ==================== Platform Types ====================

export type PlatformKey =
  | "instagram_post"
  | "instagram_story"
  | "instagram_reel"
  | "tiktok"
  | "twitter"
  | "linkedin_post"
  | "linkedin_carousel"
  | "facebook"
  | "youtube_thumbnail"
  | "pinterest"
  | "threads"
  | "snapchat";

export interface PlatformPreset {
  key: PlatformKey;
  name: string;
  platform: string;
  width: number;
  height: number;
  aspectRatio: string;
  icon: string; // lucide icon name
}

export type ImageSize = `${number}x${number}`;

// ==================== Style Guide Types ====================

export interface LayoutArchetype {
  name: string; // short slug, e.g. "big_stat_number"
  composition: string; // where text/numbers/icons/imagery go and how they're arranged
}

export interface StyleGuideData {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor?: string; // unset = AI decides from visual DNA, set = enforced
  headingFont: string;
  bodyFont: string;
  tone: "professional" | "casual" | "bold" | "minimal" | "playful";
  extraNotes?: string;
  referenceImages?: string[];
  generationPool?: string[];
  rawMarkdown?: string;
  layoutArchetypes?: LayoutArchetype[];
}

// ==================== Channel / Project Types ====================

export interface ChannelWithBrand {
  id: string;
  brandId: string;
  name: string;
  platform: string;
  description?: string | null;
  styleOverrides?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  brand: {
    id: string;
    name: string;
    logo?: string | null;
    styleGuide?: StyleGuideData | null;
  };
}

// ==================== Post / Calendar Types ====================

export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface CalendarPost {
  id: string;
  title?: string | null;
  caption?: string | null;
  imageUrl?: string | null;
  platform: string;
  size: string;
  status: PostStatus;
  scheduledAt?: Date | null;
  channelId: string;
  channelName?: string;
}

// ==================== Job Types ====================

export interface JobConfig {
  name: string;
  channelId: string;
  prompt: string;
  schedule: string; // "09:00,17:00" or cron
  platform: string;
  size: string;
  deliveryEmail: boolean;
  deliveryTelegram: boolean;
  deliverySocial: boolean;
  telegramChatId?: string;
}

// ==================== Chat Types ====================

export interface CarouselSlideMessage {
  slideNumber: number;
  role: string;
  headline: string;
  body: string;
  imageUrl: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageUrl?: string | null;
  carouselSlides?: CarouselSlideMessage[] | null;
  createdAt: Date;
  isLoading?: boolean;
}

// ==================== Onboarding Types ====================

export interface OnboardingData {
  brandName: string;
  brandLogo?: File | null;
  channelName: string;
  platform: PlatformKey;
  styleGuide: Partial<StyleGuideData>;
  referenceFiles?: File[];
}

// ==================== API Response Types ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
