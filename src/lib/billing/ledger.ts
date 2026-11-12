// ============================================================
// UXLLY Billing — ledger (append-only credit events)
// Never UPDATE or DELETE a credit event. Corrections are new events.
// Idempotency: pass `ref` (e.g. "pi:pi_123", "inv:in_456", a request id).
// A second insert with the same (userId, ref) is a no-op, so Stripe
// redelivering a webhook can never double-grant.
// ============================================================

import { db } from "@/lib/db";
import { computeBalance } from "./balance";
import { getSettings } from "./settings";

export type EventKind =
  | "purchase"   // pay-as-you-go top-up
  | "autoreload" // automatic top-up
  | "plan"       // subscription cycle credits
  | "admin"      // manual grant by you
  | "usage"      // spent on an AI action
  | "free"       // a free-trial generation (delta 0)
  | "note";      // informational (delta 0)

export async function getBalance(userId: string) {
  const rows = await db.creditEvent.findMany({
    where: { userId, deltaMilli: { not: 0 } },
    select: { deltaMilli: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "asc" },
  });
  return computeBalance(rows);
}

export async function getBalanceMilli(userId: string) {
  return (await getBalance(userId)).balanceMilli;
}

interface GrantInput {
  userId: string;
  amountMilli: number;
  kind: EventKind;
  ref?: string;
  note?: string;
  meta?: Record<string, unknown>;
  /** override expiry in days; null = never expires; undefined = settings.creditExpiryDays */
  expireDays?: number | null;
}

export async function grantCredits(i: GrantInput): Promise<{ duplicate: boolean }> {
  if (i.amountMilli <= 0) return { duplicate: false };
  const settings = await getSettings();
  const days = i.expireDays === undefined ? settings.creditExpiryDays : i.expireDays;
  const expiresAt = days ? new Date(Date.now() + days * 86_400_000) : null;
  try {
    await db.creditEvent.create({
      data: {
        userId: i.userId,
        deltaMilli: Math.round(i.amountMilli),
        kind: i.kind,
        ref: i.ref ?? null,
        note: i.note ?? null,
        meta: (i.meta as never) ?? undefined,
        expiresAt,
      },
    });
    return { duplicate: false };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { duplicate: true };
    throw e;
  }
}

export async function debitCredits(i: {
  userId: string;
  amountMilli: number;
  ref?: string;
  note?: string;
  meta?: Record<string, unknown>;
}): Promise<{ duplicate: boolean }> {
  if (i.amountMilli <= 0) return { duplicate: false };
  try {
    await db.creditEvent.create({
      data: {
        userId: i.userId,
        deltaMilli: -Math.round(i.amountMilli),
        kind: "usage",
        ref: i.ref ?? null,
        note: i.note ?? null,
        meta: (i.meta as never) ?? undefined,
      },
    });
    return { duplicate: false };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { duplicate: true };
    throw e;
  }
}

export async function writeNote(userId: string, note: string, ref?: string) {
  try {
    await db.creditEvent.create({ data: { userId, deltaMilli: 0, kind: "note", note, ref: ref ?? null } });
  } catch {
    /* notes are best-effort */
  }
}

export async function getHistory(userId: string, limit = 100) {
  return db.creditEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, deltaMilli: true, kind: true, note: true, meta: true, expiresAt: true, createdAt: true },
  });
}
