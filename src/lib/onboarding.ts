// ============================================================
// UXLLY — Onboarding questions (shared by client + server)
// The answers are saved per user and will later drive template
// recommendations. Keep option `value`s stable once live: they are what
// gets stored in the database.
// ============================================================

export interface Option {
  value: string;
  label: string;
  hint?: string;
  swatch?: string[]; // colour dots for the style step
}

export const INDUSTRIES: Option[] = [
  { value: "food", label: "Food & drink" },
  { value: "fashion", label: "Fashion & apparel" },
  { value: "beauty", label: "Beauty & cosmetics" },
  { value: "fitness", label: "Health & fitness" },
  { value: "tech", label: "Tech & SaaS" },
  { value: "ecommerce", label: "E-commerce / retail" },
  { value: "realestate", label: "Real estate" },
  { value: "finance", label: "Finance & crypto" },
  { value: "education", label: "Education & coaching" },
  { value: "travel", label: "Travel & hospitality" },
  { value: "events", label: "Events & entertainment" },
  { value: "agency", label: "Marketing agency" },
  { value: "creator", label: "Creator / personal brand" },
  { value: "nonprofit", label: "Non-profit / church" },
  { value: "other", label: "Other" },
];

export const PLATFORMS: Option[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
  { value: "pinterest", label: "Pinterest" },
  { value: "youtube", label: "YouTube" },
  { value: "threads", label: "Threads" },
  { value: "whatsapp", label: "WhatsApp status" },
];

export const POSTS_PER_DAY: Option[] = [
  { value: "few_week", label: "A few a week" },
  { value: "1", label: "1 a day" },
  { value: "2", label: "2 a day" },
  { value: "3", label: "3 a day" },
  { value: "5plus", label: "5+ a day" },
];

export const GOALS: Option[] = [
  { value: "sales", label: "Get more sales" },
  { value: "awareness", label: "Brand awareness" },
  { value: "followers", label: "Grow followers" },
  { value: "engagement", label: "More engagement" },
  { value: "launch", label: "Launch a product" },
  { value: "events", label: "Promote events / offers" },
  { value: "save_time", label: "Save time on design" },
];

export const STYLES: Option[] = [
  { value: "minimal", label: "Minimal", hint: "Clean, lots of space", swatch: ["#FFFFFF", "#E5E5E5", "#111111"] },
  { value: "bold", label: "Bold", hint: "Big type, strong colour", swatch: ["#FF3B30", "#111111", "#FFD60A"] },
  { value: "luxury", label: "Luxury", hint: "Dark, gold, elegant", swatch: ["#0B0B0B", "#C9A45C", "#F3E9D2"] },
  { value: "playful", label: "Playful", hint: "Fun, bright, friendly", swatch: ["#FF7AC6", "#7AE7FF", "#FFE066"] },
  { value: "corporate", label: "Corporate", hint: "Trustworthy, tidy", swatch: ["#0A3D91", "#5B8DEF", "#F2F5FA"] },
  { value: "natural", label: "Natural", hint: "Earthy, soft tones", swatch: ["#6B8F5E", "#D9C8A9", "#F6F1E7"] },
  { value: "retro", label: "Retro", hint: "Vintage, grainy", swatch: ["#E76F51", "#F4A261", "#2A9D8F"] },
  { value: "futuristic", label: "Futuristic", hint: "Neon, gradients, 3D", swatch: ["#7B2FF7", "#00E5FF", "#0A0A23"] },
];

export const ROLES: Option[] = [
  { value: "owner", label: "Business owner" },
  { value: "marketer", label: "Marketer" },
  { value: "social_manager", label: "Social media manager" },
  { value: "designer", label: "Designer" },
  { value: "creator", label: "Creator" },
  { value: "agency", label: "Agency" },
  { value: "other", label: "Other" },
];

export const TEAM_SIZES: Option[] = [
  { value: "1", label: "Just me" },
  { value: "2-5", label: "2–5" },
  { value: "6-20", label: "6–20" },
  { value: "21-100", label: "21–100" },
  { value: "100+", label: "100+" },
];

export const REFERRALS: Option[] = [
  { value: "google", label: "Google search" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X (Twitter)" },
  { value: "youtube", label: "YouTube" },
  { value: "friend", label: "Friend or colleague" },
  { value: "ai", label: "ChatGPT / AI assistant" },
  { value: "other", label: "Other" },
];

export interface OnboardingAnswers {
  businessName: string | null;
  offering: string | null;
  industry: string | null;
  industryOther: string | null;
  hasWebsite: boolean | null;
  websiteUrl: string | null;
  platforms: string[];
  postsPerDay: string | null;
  goals: string[];
  styles: string[];
  role: string | null;
  teamSize: string | null;
  referral: string | null;
}

export const EMPTY_ANSWERS: OnboardingAnswers = {
  businessName: null,
  offering: null,
  industry: null,
  industryOther: null,
  hasWebsite: null,
  websiteUrl: null,
  platforms: [],
  postsPerDay: null,
  goals: [],
  styles: [],
  role: null,
  teamSize: null,
  referral: null,
};

export type OnboardingStatus = "none" | "skipped" | "completed";

// ==================== Server-side cleaning ====================
// Anything not in the option lists is dropped, free text is trimmed and
// capped, so the table only ever holds values we understand.

const pick = (list: Option[], v: unknown) => (typeof v === "string" && list.some((o) => o.value === v) ? v : null);
const pickMany = (list: Option[], v: unknown) =>
  Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === "string" && list.some((o) => o.value === x)))) : [];
const text = (v: unknown, max: number) => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
};

export function normalizeUrl(v: unknown): string | null {
  const t = text(v, 300);
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Only the keys present in `raw` are returned, so partial saves don't wipe earlier answers. */
export function cleanAnswers(raw: Record<string, unknown>): Partial<OnboardingAnswers> {
  const out: Partial<OnboardingAnswers> = {};
  const has = (k: keyof OnboardingAnswers) => Object.prototype.hasOwnProperty.call(raw, k);
  if (has("businessName")) out.businessName = text(raw.businessName, 120);
  if (has("offering")) out.offering = text(raw.offering, 500);
  if (has("industry")) out.industry = pick(INDUSTRIES, raw.industry);
  if (has("industryOther")) out.industryOther = text(raw.industryOther, 80);
  if (has("hasWebsite")) out.hasWebsite = typeof raw.hasWebsite === "boolean" ? raw.hasWebsite : null;
  if (has("websiteUrl")) out.websiteUrl = normalizeUrl(raw.websiteUrl);
  if (has("platforms")) out.platforms = pickMany(PLATFORMS, raw.platforms);
  if (has("postsPerDay")) out.postsPerDay = pick(POSTS_PER_DAY, raw.postsPerDay);
  if (has("goals")) out.goals = pickMany(GOALS, raw.goals);
  if (has("styles")) out.styles = pickMany(STYLES, raw.styles);
  if (has("role")) out.role = pick(ROLES, raw.role);
  if (has("teamSize")) out.teamSize = pick(TEAM_SIZES, raw.teamSize);
  if (has("referral")) out.referral = pick(REFERRALS, raw.referral);
  if (out.hasWebsite === false) out.websiteUrl = null;
  if (out.industry && out.industry !== "other") out.industryOther = null;
  return out;
}

export function labelOf(list: Option[], v: string | null | undefined): string {
  return list.find((o) => o.value === v)?.label ?? (v || "");
}
