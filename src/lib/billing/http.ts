// ============================================================
// UXLLY Billing — shared HTTP helpers for API routes
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InsufficientCreditsError } from "./meter";

/** 402 body the client understands: opens the "Add credits" popup. */
export function insufficientResponse(err: InsufficientCreditsError) {
  return NextResponse.json(
    {
      error: "insufficient_credits",
      message: "You're out of credits. Top up to keep creating.",
      neededMilli: err.neededMilli,
      balanceMilli: err.balanceMilli,
    },
    { status: 402 }
  );
}

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
