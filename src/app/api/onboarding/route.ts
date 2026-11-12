// ============================================================
// UXLLY — Onboarding answers
//   GET  → { status: "none" | "skipped" | "completed", answers }
//   POST { action: "save", answers }      partial save (each step)
//   POST { action: "complete", answers }  finish
//   POST { action: "skip", answers? }     "Skip for now" — remind later
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanAnswers, EMPTY_ANSWERS, type OnboardingAnswers, type OnboardingStatus } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

async function userId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

type Row = OnboardingAnswers & { completedAt: Date | null; skippedAt: Date | null };

function toAnswers(row: Row | null): OnboardingAnswers {
  if (!row) return { ...EMPTY_ANSWERS };
  const a = { ...EMPTY_ANSWERS };
  for (const k of Object.keys(EMPTY_ANSWERS) as (keyof OnboardingAnswers)[]) {
    (a as Record<string, unknown>)[k] = row[k] ?? EMPTY_ANSWERS[k];
  }
  return a;
}

function statusOf(row: Row | null): OnboardingStatus {
  if (!row) return "none";
  if (row.completedAt) return "completed";
  if (row.skippedAt) return "skipped";
  return "none";
}

export async function GET() {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const row = (await db.userProfile.findUnique({ where: { userId: uid } })) as Row | null;
  return NextResponse.json({ status: statusOf(row), answers: toAnswers(row) });
}

export async function POST(request: Request) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action as string;
  if (!["save", "complete", "skip"].includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const data: Record<string, unknown> = cleanAnswers(body?.answers && typeof body.answers === "object" ? body.answers : {});
  if (action === "complete") data.completedAt = new Date();
  if (action === "skip") data.skippedAt = new Date();

  try {
    const row = (await db.userProfile.upsert({
      where: { userId: uid },
      create: { userId: uid, ...data },
      update: data,
    })) as Row;
    return NextResponse.json({ status: statusOf(row), answers: toAnswers(row) });
  } catch (e) {
    console.error("[ONBOARDING] save failed:", e);
    return NextResponse.json({ error: "Could not save your answers" }, { status: 500 });
  }
}
