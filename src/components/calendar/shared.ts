// ============================================================
// UXLLY — Calendar shared types + helpers
// ============================================================
export type EvKind = "plan" | "post" | "auto";

export interface Ev {
  id: string;
  kind: EvKind;
  at: Date;
  title: string;
  sub: string;
  family: string; // instagram | facebook | linkedin | ...
  status: string; // plan statuses, or "made" for posts, "auto" for automations
  format?: string;
  raw: unknown;
}

export const familyOf = (p: string): string => {
  const f = (p || "").toLowerCase();
  if (f.startsWith("instagram")) return "instagram";
  if (f.startsWith("facebook")) return "facebook";
  if (f.startsWith("linkedin")) return "linkedin";
  if (f.startsWith("tiktok")) return "tiktok";
  if (f === "x" || f.startsWith("twitter")) return "x";
  if (f.startsWith("pinterest")) return "pinterest";
  if (f.startsWith("youtube")) return "youtube";
  if (f.startsWith("threads")) return "threads";
  if (f.startsWith("snapchat")) return "snapchat";
  if (f.startsWith("whatsapp")) return "whatsapp";
  return "other";
};

export const FAMILY_LABEL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", x: "X",
  pinterest: "Pinterest", youtube: "YouTube", threads: "Threads", snapchat: "Snapchat", whatsapp: "WhatsApp", other: "Other",
};

// Soft pastel per platform (card background, border, accent dot)
export const TONE: Record<string, { bg: string; bd: string; dot: string }> = {
  instagram: { bg: "bg-[#F3EEFD]", bd: "border-[#E0D5F8]", dot: "bg-[#8B5CF6]" },
  facebook: { bg: "bg-[#EAF1FE]", bd: "border-[#D3E2FB]", dot: "bg-[#3B82F6]" },
  linkedin: { bg: "bg-[#E6F4FB]", bd: "border-[#C9E6F5]", dot: "bg-[#0EA5E9]" },
  tiktok: { bg: "bg-[#FDECF3]", bd: "border-[#F8D3E2]", dot: "bg-[#EC4899]" },
  x: { bg: "bg-[#F1F1F2]", bd: "border-[#E2E2E4]", dot: "bg-[#27272A]" },
  pinterest: { bg: "bg-[#FDEBEB]", bd: "border-[#F8D2D2]", dot: "bg-[#EF4444]" },
  youtube: { bg: "bg-[#FDEBEB]", bd: "border-[#F8D2D2]", dot: "bg-[#DC2626]" },
  threads: { bg: "bg-[#F1F1F2]", bd: "border-[#E2E2E4]", dot: "bg-[#52525B]" },
  snapchat: { bg: "bg-[#FEF7D6]", bd: "border-[#F8EBA6]", dot: "bg-[#EAB308]" },
  whatsapp: { bg: "bg-[#E8F7EC]", bd: "border-[#CDEBD6]", dot: "bg-[#22C55E]" },
  other: { bg: "bg-[#F4F4F5]", bd: "border-[#E4E4E7]", dot: "bg-[#71717A]" },
};

export const HOUR_H = 56;
