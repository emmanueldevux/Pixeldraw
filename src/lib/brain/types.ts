// ============================================================
// UXLLY — Brand Brain: shape + cleaning (shared client/server)
//
// The brain is WHO the brand is (business, products, audience, voice,
// positioning, offers). It drives the copy and message of every design.
// HOW a design looks comes from the chosen ad reference, not from here.
//
// Stored per project (Brand) as JSON in BrandBrain.data. Sections the user
// has edited are listed in BrandBrain.edited so "Regenerate" never wipes
// their changes unless they regenerate that section explicitly.
// ============================================================

export interface BrainBusiness {
  name: string;
  whatYouSell: string;
  industry: string;
  location: string;
  website: string;
  summary: string; // 2–3 sentences: category, what they sell, who it's for
}

export interface BrainProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  claims: string[]; // short factual selling points used to ground copy
}

export interface BrainAvatar {
  id: string;
  name: string; // "Ada"
  type: string; // "The Busy Office Worker"
  life: string; // one concrete moment the product matters
  painWords: string[]; // their own words — become headlines
  wants: string;
  objections: { doubt: string; answer: string }[];
  driver: string; // emotional driver
  adAngle: string; // what an ad for this person leads with
}

export interface BrainVoice {
  oneLine: string;
  traits: string[];
  rhythm: string;
  address: string; // we / you / imperative
  emoji: string; // never / sparingly / often
  useWords: string[];
  avoidWords: string[];
  examples: { headline: string; caption: string; cta: string };
  dos: string[];
  donts: string[];
}

export interface BrainPositioning {
  standsAgainst: string;
  counterPosition: string;
  valueProp: string;
  without: string; // the trade-off competitors force that this brand removes
  pillars: string[]; // content pillars
}

export interface BrainOffer {
  id: string; // O1, O2 … stable once written
  title: string;
  details: string;
  code: string;
  isGuarantee: boolean;
}

export interface BrainData {
  business: BrainBusiness;
  products: BrainProduct[];
  audience: BrainAvatar[];
  voice: BrainVoice;
  positioning: BrainPositioning;
  offers: BrainOffer[];
  offerRules: string; // stacking rules / how loudly to merchandise
}

export type BrainSection = keyof BrainData;
export const SECTIONS: BrainSection[] = ["business", "products", "audience", "voice", "positioning", "offers", "offerRules"];
/** Sections the AI is allowed to write. Offers are never invented by the AI. */
export const AI_SECTIONS: BrainSection[] = ["business", "products", "audience", "voice", "positioning"];

export type BrainStatus = "empty" | "generating" | "ready" | "failed";

export interface BrainRecord {
  brandId: string;
  status: BrainStatus;
  data: BrainData;
  edited: BrainSection[];
  generatedAt: string | null;
  updatedAt: string | null;
}

export const EMPTY_BRAIN: BrainData = {
  business: { name: "", whatYouSell: "", industry: "", location: "", website: "", summary: "" },
  products: [],
  audience: [],
  voice: {
    oneLine: "", traits: [], rhythm: "", address: "", emoji: "",
    useWords: [], avoidWords: [], examples: { headline: "", caption: "", cta: "" }, dos: [], donts: [],
  },
  positioning: { standsAgainst: "", counterPosition: "", valueProp: "", without: "", pillars: [] },
  offers: [],
  offerRules: "",
};

// ==================== Cleaning ====================
// Everything that reaches the database goes through these, whether it came
// from the AI or from the edit page, so the shape is always predictable.

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max = 12, each = 200) =>
  Array.isArray(v) ? v.map((x) => str(x, each)).filter(Boolean).slice(0, max) : [];
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const rid = () => Math.random().toString(36).slice(2, 10);

export function cleanSection<S extends BrainSection>(section: S, raw: unknown): BrainData[S] {
  switch (section) {
    case "business": {
      const o = obj(raw);
      return {
        name: str(o.name, 120), whatYouSell: str(o.whatYouSell, 500), industry: str(o.industry, 80),
        location: str(o.location, 120), website: str(o.website, 300), summary: str(o.summary, 800),
      } as BrainData[S];
    }
    case "products":
      return (Array.isArray(raw) ? raw : []).slice(0, 30).map((p) => {
        const o = obj(p);
        return { id: str(o.id, 20) || rid(), name: str(o.name, 120), description: str(o.description, 500), price: str(o.price, 40), claims: list(o.claims, 6, 160) };
      }).filter((p) => p.name) as BrainData[S];
    case "audience":
      return (Array.isArray(raw) ? raw : []).slice(0, 5).map((a) => {
        const o = obj(a);
        const objections = (Array.isArray(o.objections) ? o.objections : []).slice(0, 4).map((x) => {
          const q = obj(x);
          return { doubt: str(q.doubt, 200), answer: str(q.answer, 300) };
        }).filter((q) => q.doubt);
        return {
          id: str(o.id, 20) || rid(), name: str(o.name, 40), type: str(o.type, 80), life: str(o.life, 400),
          painWords: list(o.painWords, 6, 160), wants: str(o.wants, 300), objections,
          driver: str(o.driver, 200), adAngle: str(o.adAngle, 300),
        };
      }).filter((a) => a.name || a.type) as BrainData[S];
    case "voice": {
      const o = obj(raw);
      const ex = obj(o.examples);
      return {
        oneLine: str(o.oneLine, 300), traits: list(o.traits, 5, 80), rhythm: str(o.rhythm, 200),
        address: str(o.address, 120), emoji: str(o.emoji, 120), useWords: list(o.useWords, 15, 40),
        avoidWords: list(o.avoidWords, 15, 40),
        examples: { headline: str(ex.headline, 160), caption: str(ex.caption, 400), cta: str(ex.cta, 60) },
        dos: list(o.dos, 6, 200), donts: list(o.donts, 6, 200),
      } as BrainData[S];
    }
    case "positioning": {
      const o = obj(raw);
      return {
        standsAgainst: str(o.standsAgainst, 300), counterPosition: str(o.counterPosition, 400),
        valueProp: str(o.valueProp, 300), without: str(o.without, 200), pillars: list(o.pillars, 5, 160),
      } as BrainData[S];
    }
    case "offers": {
      const seen = new Set<string>();
      return (Array.isArray(raw) ? raw : []).slice(0, 12).map((x, n) => {
        const o = obj(x);
        let id = str(o.id, 6).toUpperCase();
        if (!/^O\d+$/.test(id) || seen.has(id)) id = `O${n + 1}`;
        while (seen.has(id)) id = `O${Number(id.slice(1)) + 1}`;
        seen.add(id);
        return { id, title: str(o.title, 120), details: str(o.details, 400), code: str(o.code, 40), isGuarantee: o.isGuarantee === true };
      }).filter((o) => o.title) as BrainData[S];
    }
    case "offerRules":
      return str(raw, 1000) as BrainData[S];
  }
  return EMPTY_BRAIN[section];
}

export function cleanBrain(raw: unknown): BrainData {
  const o = obj(raw);
  const out = { ...EMPTY_BRAIN } as BrainData;
  for (const s of SECTIONS) {
    if (o[s] !== undefined) (out as unknown as Record<string, unknown>)[s] = cleanSection(s, o[s]);
  }
  return out;
}

export function isEmptyBrain(d: BrainData): boolean {
  return !d.business.summary && !d.business.whatYouSell && d.audience.length === 0 && !d.voice.oneLine;
}
