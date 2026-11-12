// ============================================================
// UXLLY — Brand Brain API (per project / brand)
//   GET  ?brandId=…                                → BrainRecord
//   PUT  { brandId, section, value }               → save one edited section
//   POST { brandId, sections? }                    → (re)generate with AI
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateBrain, getBrain, ownedBrand, saveSection } from "@/lib/brain/generate";
import { SECTIONS, type BrainSection } from "@/lib/brain/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI generation can take ~20–40s

async function authed(brandId: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Sign in first" }, { status: 401 }) };
  if (typeof brandId !== "string" || !brandId) return { error: NextResponse.json({ error: "brandId is required" }, { status: 400 }) };
  const brand = await ownedBrand(brandId, session.user.id);
  if (!brand) return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  return { brandId };
}

export async function GET(request: Request) {
  const a = await authed(new URL(request.url).searchParams.get("brandId"));
  if ("error" in a) return a.error;
  return NextResponse.json(await getBrain(a.brandId));
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const a = await authed(body?.brandId);
  if ("error" in a) return a.error;
  if (!SECTIONS.includes(body?.section)) return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  try {
    return NextResponse.json(await saveSection(a.brandId, body.section as BrainSection, body.value));
  } catch (e) {
    console.error("[BRAIN] save failed:", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const a = await authed(body?.brandId);
  if ("error" in a) return a.error;
  const sections = Array.isArray(body?.sections) ? (body.sections.filter((s: unknown) => SECTIONS.includes(s as BrainSection)) as BrainSection[]) : undefined;
  const current = await getBrain(a.brandId);
  if (current.status === "generating") return NextResponse.json(current, { status: 202 });
  const rec = await generateBrain(a.brandId, sections);
  if (rec.status === "failed") return NextResponse.json({ ...rec, error: "The AI couldn't build the brain this time. Try again." }, { status: 502 });
  return NextResponse.json(rec);
}
