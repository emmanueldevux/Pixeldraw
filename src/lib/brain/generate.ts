// ============================================================
// UXLLY — Brand Brain: storage + AI generation (server only)
//
// Sources, in order of trust:
//   1. What the user typed (onboarding answers, project name/description,
//      the e-commerce product in Project settings, prior brain edits)
//   2. The brand analysis already saved on the project (rawMarkdown)
//   3. Website TEXT, best effort, only for wording/products/voice. Visual
//      style never comes from the website — that's the ad reference's job.
// The AI writes business, products, audience, voice and positioning.
// It never writes offers: offers are only what the user enters.
// ============================================================

import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai/provider";
import {
  AI_SECTIONS,
  EMPTY_BRAIN,
  cleanBrain,
  cleanSection,
  isEmptyBrain,
  type BrainData,
  type BrainRecord,
  type BrainSection,
  type BrainStatus,
} from "./types";
import { GOALS, INDUSTRIES, PLATFORMS, POSTS_PER_DAY, STYLES, labelOf } from "@/lib/onboarding";

type Row = {
  brandId: string;
  status: string;
  data: unknown;
  edited: string[];
  generatedAt: Date | null;
  updatedAt: Date | null;
};

function toRecord(brandId: string, row: Row | null): BrainRecord {
  if (!row) {
    return { brandId, status: "empty", data: structuredClone(EMPTY_BRAIN), edited: [], generatedAt: null, updatedAt: null };
  }
  let status = (row.status as BrainStatus) || "ready";
  // A generation that died mid-way (server restart) must not spin forever.
  if (status === "generating" && row.updatedAt && Date.now() - row.updatedAt.getTime() > 3 * 60_000) {
    status = isEmptyBrain(cleanBrain(row.data)) ? "failed" : "ready";
  }
  return {
    brandId,
    status,
    data: cleanBrain(row.data),
    edited: (row.edited || []).filter((s): s is BrainSection => (Object.keys(EMPTY_BRAIN) as string[]).includes(s)),
    generatedAt: row.generatedAt ? row.generatedAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/** Brand must belong to the user. Returns null when it doesn't. */
export async function ownedBrand(brandId: string, userId: string) {
  return db.brand.findFirst({ where: { id: brandId, userId } });
}

export async function getBrain(brandId: string): Promise<BrainRecord> {
  const row = (await db.brandBrain.findUnique({ where: { brandId } })) as Row | null;
  return toRecord(brandId, row);
}

export async function saveSection(brandId: string, section: BrainSection, value: unknown): Promise<BrainRecord> {
  const current = await getBrain(brandId);
  const data = { ...current.data, [section]: cleanSection(section, value) } as BrainData;
  const edited = Array.from(new Set([...current.edited, section]));
  const row = (await db.brandBrain.upsert({
    where: { brandId },
    create: { brandId, status: "ready", data: data as never, edited },
    update: { data: data as never, edited, status: current.status === "empty" ? "ready" : undefined },
  })) as Row;
  return toRecord(brandId, row);
}

// ==================== Gathering what we know ====================

async function websiteText(url: string): Promise<string> {
  try {
    const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(u, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; UXLLYBrandBrain/1.0)" } });
    clearTimeout(t);
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 400_000);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
    const body = html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return [title && `Title: ${title}`, desc && `Description: ${desc}`, body.slice(0, 6000)].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

async function gatherContext(brandId: string, existing: BrainData): Promise<string> {
  const brand = await db.brand.findUnique({
    where: { id: brandId },
    include: { styleGuide: true, channels: true },
  });
  if (!brand) return "";
  const sg = brand.styleGuide as unknown as Record<string, unknown> | null;
  const advanced = ((sg?.advancedSettings as Record<string, unknown>) || {}) as Record<string, unknown>;
  const ecom = (advanced.ecommerce as Record<string, unknown>) || null;

  const profile = await db.userProfile.findUnique({ where: { userId: brand.userId } }).catch(() => null);

  const parts: string[] = [];
  parts.push(`PROJECT NAME: ${brand.name}`);
  for (const ch of brand.channels as { name: string; platform: string; description?: string | null }[]) {
    parts.push(`CHANNEL: ${ch.name} (${ch.platform})${ch.description ? ` — ${ch.description}` : ""}`);
  }
  if (sg?.tone) parts.push(`CHOSEN TONE: ${sg.tone}`);
  if (sg?.extraNotes) parts.push(`OWNER NOTES: ${String(sg.extraNotes).slice(0, 1500)}`);
  if (ecom && (ecom.productName || ecom.productDescription)) {
    parts.push(
      `PRODUCT FROM SETTINGS: ${ecom.productName || ""} — ${ecom.productDescription || ""}` +
        (ecom.price ? ` | price ${ecom.price}` : "") +
        (ecom.salePrice ? ` | sale ${ecom.salePrice}` : "") +
        (ecom.promoCode ? ` | code ${ecom.promoCode}` : ""),
    );
  }
  if (profile) {
    const p = profile as unknown as Record<string, unknown>;
    const many = (list: typeof GOALS, v: unknown) => (Array.isArray(v) ? v.map((x) => labelOf(list, String(x))).join(", ") : "");
    parts.push(
      [
        "ONBOARDING ANSWERS (from the account owner):",
        p.businessName && `- Business name: ${p.businessName}`,
        p.offering && `- What they sell: ${p.offering}`,
        p.industry && `- Industry: ${p.industry === "other" ? p.industryOther || "other" : labelOf(INDUSTRIES, String(p.industry))}`,
        p.websiteUrl && `- Website: ${p.websiteUrl}`,
        many(PLATFORMS, p.platforms) && `- Posts on: ${many(PLATFORMS, p.platforms)}`,
        p.postsPerDay && `- Posting: ${labelOf(POSTS_PER_DAY, String(p.postsPerDay))}`,
        many(GOALS, p.goals) && `- Goals: ${many(GOALS, p.goals)}`,
        many(STYLES, p.styles) && `- Likes styles: ${many(STYLES, p.styles)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (sg?.rawMarkdown) parts.push(`EARLIER BRAND ANALYSIS (may be partial):\n${String(sg.rawMarkdown).slice(0, 4000)}`);
  if (existing.offers.length) parts.push(`OFFERS THE OWNER ENTERED: ${existing.offers.map((o) => `${o.id} ${o.title} — ${o.details}`).join("; ")}`);
  if (existing.products.length) parts.push(`PRODUCTS ALREADY IN THE BRAIN: ${existing.products.map((p) => `${p.name}: ${p.description}`).join("; ")}`);

  const site = existing.business.website || (profile as unknown as { websiteUrl?: string } | null)?.websiteUrl || "";
  if (site) {
    const text = await websiteText(site);
    if (text) parts.push(`WEBSITE TEXT (for wording, products and voice only):\n${text}`);
  }
  return parts.join("\n\n");
}

// ==================== The AI call ====================

const SYSTEM = `You are a senior brand strategist and copy chief for a social-media design tool.
From what the business owner told us, build their brand brain: who they are, who they sell to,
how they sound, and why they win. This brain will drive every caption, headline and ad.

Rules:
- Ground everything in the information given. Where you infer, keep it plausible and specific to THIS business; never generic.
- Never invent prices, discount codes, guarantees, awards, statistics, certifications or customer counts.
- Audience: 3 to 5 named people who differ by WHY they buy, not by demographics. "life" is one concrete, filmable moment.
  "painWords" are short phrases in the customer's own casual words (they become headlines). Objections each get an honest answer the business can stand behind.
- Voice: precise traits ("plain-spoken", "dry-witted"), never "friendly" or "premium". Give one example headline, caption and CTA that sound exactly like the brand.
- Positioning: name what the brand stands against (an industry habit, not a competitor's name), a counter-position line,
  a value proposition, and the "without" clause: the trade-off other options force on customers that this brand removes. 3 to 5 content pillars.
- Products: only products actually mentioned. Claims are short factual selling points taken from the information; no invented specs.
- Match the market: if the business is local (e.g. Nigeria), write in the way that audience speaks.

Return ONLY a JSON object, no markdown, with exactly these keys:
{
  "business": {"name","whatYouSell","industry","location","website","summary"},
  "products": [{"name","description","price","claims":[]}],
  "audience": [{"name","type","life","painWords":[],"wants","objections":[{"doubt","answer"}],"driver","adAngle"}],
  "voice": {"oneLine","traits":[],"rhythm","address","emoji","useWords":[],"avoidWords":[],"examples":{"headline","caption","cta"},"dos":[],"donts":[]},
  "positioning": {"standsAgainst","counterPosition","valueProp","without","pillars":[]}
}
Use "" or [] when there is genuinely nothing to go on.`;

function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Generate (or regenerate) the brain.
 * - `sections` limits which sections are rewritten (default: all AI sections).
 * - Sections the user edited are kept, unless they're named in `sections`.
 */
export async function generateBrain(brandId: string, sections?: BrainSection[]): Promise<BrainRecord> {
  const current = await getBrain(brandId);
  const explicit = sections && sections.length > 0;
  const target = (explicit ? sections! : AI_SECTIONS).filter((s) => AI_SECTIONS.includes(s));
  const writable = target.filter((s) => explicit || !current.edited.includes(s));

  await db.brandBrain.upsert({
    where: { brandId },
    create: { brandId, status: "generating", data: current.data as never, edited: current.edited },
    update: { status: "generating" },
  });

  try {
    const context = await gatherContext(brandId, current.data);
    const res = await aiComplete({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Here is everything we know about this business:\n\n${context}\n\nBuild the brand brain JSON now.` },
      ],
      temperature: 0.6,
      maxTokens: 3500,
    });
    const ai = cleanBrain(parseJson(res.content));
    const data = { ...current.data };
    for (const s of writable) (data as unknown as Record<string, unknown>)[s] = ai[s];
    // keep user-typed facts the AI may have dropped
    if (!data.business.website && current.data.business.website) data.business.website = current.data.business.website;

    const edited = explicit ? current.edited.filter((s) => !writable.includes(s)) : current.edited;
    const row = (await db.brandBrain.update({
      where: { brandId },
      data: { status: "ready", data: data as never, edited, generatedAt: new Date() },
    })) as Row;
    return toRecord(brandId, row);
  } catch (e) {
    console.error("[BRAIN] generation failed:", e);
    const row = (await db.brandBrain.update({
      where: { brandId },
      data: { status: isEmptyBrain(current.data) ? "failed" : "ready" },
    })) as Row;
    return toRecord(brandId, row);
  }
}

/**
 * Make sure a brain exists before it's needed (templates call this).
 * Empty or failed → build now; already building → wait for it (up to ~60s).
 */
export async function ensureBrain(brandId: string): Promise<BrainRecord> {
  let rec = await getBrain(brandId);
  if (rec.status === "generating") {
    for (let i = 0; i < 20 && rec.status === "generating"; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      rec = await getBrain(brandId);
    }
    return rec;
  }
  if (isEmptyBrain(rec.data)) rec = await generateBrain(brandId);
  return rec;
}
