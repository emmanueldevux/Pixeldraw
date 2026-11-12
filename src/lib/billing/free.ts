// ============================================================
// UXLLY Billing — free trial
// Rule (from you): 2 images on the first day, 1 more on a later day,
// then locked until you open it again in /admin. After the 3rd we always
// ask for money. All numbers are editable in /admin.
//   - Only a PRODUCED IMAGE uses up an allowance.
//   - A free trial image is a ledger event with delta 0 (kind "free").
//   - Admin can add "free bonus" images to one user to unlock them again.
// Days are UTC days.
// ============================================================

import { db } from "@/lib/db";
import { getSettings } from "./settings";

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export interface FreeStatus {
  enabled: boolean;
  available: boolean;
  usedTotal: number;
  cap: number;
  usedToday: number;
  todayLimit: number;
  firstDay: boolean;
}

export async function freeTrialStatus(userId: string): Promise<FreeStatus> {
  const s = await getSettings();
  const [account, usedTotal, first] = await Promise.all([
    db.billingAccount.findUnique({ where: { userId }, select: { freeBonus: true } }),
    db.creditEvent.count({ where: { userId, kind: "free" } }),
    db.creditEvent.findFirst({ where: { userId, kind: "free" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const cap = s.freeTotal + (account?.freeBonus ?? 0);
  const now = new Date();
  const startOfToday = new Date(`${dayKey(now)}T00:00:00.000Z`);
  const usedToday = await db.creditEvent.count({ where: { userId, kind: "free", createdAt: { gte: startOfToday } } });

  const firstDay = !first || dayKey(first.createdAt) === dayKey(now);
  const todayLimit = firstDay ? s.freeDay1 : s.freeLaterDay;
  // Once the standard trial (freeTotal) is used up, only admin-granted bonus
  // images remain — those have no daily limit, so "unlock" works right away.
  const inBonus = usedTotal >= s.freeTotal;
  const available = s.freeEnabled && usedTotal < cap && (inBonus || usedToday < todayLimit);
  return { enabled: s.freeEnabled, available, usedTotal, cap, usedToday, todayLimit, firstDay };
}

export async function recordFreeUse(userId: string, ref: string) {
  try {
    await db.creditEvent.create({
      data: { userId, deltaMilli: 0, kind: "free", ref, note: "Free trial image" },
    });
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002") throw e;
  }
}
