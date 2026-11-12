// ============================================================
// /api/admin/billing — admin-only (ADMIN_EMAILS in .env)
// GET  -> settings, pricing rules, plans, recent activity
// POST -> { action: saveSettings | saveRule | deleteRule | savePlan |
//                   findUser | grantCredits | removeCredits | unlockFree }
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/billing/http";
import { getSettings, saveSettings } from "@/lib/billing/settings";
import { getRules, getPlans } from "@/lib/billing/pricing";
import { getBalanceMilli, grantCredits, debitCredits } from "@/lib/billing/ledger";
import { freeTrialStatus } from "@/lib/billing/free";
import { toMilli } from "@/lib/billing/units";

export const dynamic = "force-dynamic";

const forbidden = () => NextResponse.json({ error: "Not allowed" }, { status: 403 });

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return forbidden();

  const [settings, rules, plans, recent] = await Promise.all([
    getSettings(),
    getRules(),
    getPlans(false),
    db.creditEvent.findMany({
      where: { kind: { in: ["purchase", "autoreload", "plan", "admin", "usage", "free"] } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);
  const ids = Array.from(new Set(recent.map((r) => r.userId)));
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  return NextResponse.json({
    settings,
    rules,
    plans,
    recent: recent.map((r) => ({
      id: r.id,
      email: emailOf.get(r.userId) || r.userId,
      kind: r.kind,
      deltaMilli: r.deltaMilli,
      note: r.note,
      createdAt: r.createdAt,
    })),
  });
}

async function userByEmail(email: string) {
  return db.user.findFirst({
    where: { email: { equals: String(email || "").trim(), mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return forbidden();
  const body = await request.json();

  try {
    switch (body.action) {
      case "saveSettings":
        return NextResponse.json({ settings: await saveSettings(body.settings || {}) });

      case "saveRule": {
        const r = body.rule || {};
        const key = String(r.key || "").trim();
        if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 });
        const data = {
          label: String(r.label || key),
          provider: String(r.provider || ""),
          creditsMilli: Math.max(0, Math.round(Number(r.creditsMilli) || 0)),
          costMicroUsd: Math.max(0, Math.round(Number(r.costMicroUsd) || 0)),
          active: r.active !== false,
        };
        const rule = await db.pricingRule.upsert({ where: { key }, create: { key, ...data }, update: data });
        return NextResponse.json({ rule });
      }

      case "deleteRule":
        await db.pricingRule.delete({ where: { key: String(body.key) } });
        return NextResponse.json({ ok: true });

      case "savePlan": {
        const p = body.plan || {};
        const key = String(p.key || "").trim().toLowerCase();
        if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 });
        const data = {
          name: String(p.name || key),
          priceCents: Math.max(100, Math.round(Number(p.priceCents) || 0)),
          creditsMilli: Math.max(0, Math.round(Number(p.creditsMilli) || 0)),
          sortOrder: Math.round(Number(p.sortOrder) || 0),
          active: p.active !== false,
        };
        const plan = await db.billingPlan.upsert({ where: { key }, create: { key, ...data }, update: data });
        return NextResponse.json({ plan });
      }

      case "findUser": {
        const u = await userByEmail(body.email);
        if (!u) return NextResponse.json({ error: "No user with that email" }, { status: 404 });
        const [balanceMilli, free, account, profile] = await Promise.all([
          getBalanceMilli(u.id),
          freeTrialStatus(u.id),
          db.billingAccount.findUnique({ where: { userId: u.id } }),
          db.userProfile.findUnique({ where: { userId: u.id } }).catch(() => null),
        ]);
        return NextResponse.json({ user: u, balanceMilli, free, plan: account?.planKey || null, freeBonus: account?.freeBonus ?? 0, profile });
      }

      case "grantCredits":
      case "removeCredits": {
        const u = await userByEmail(body.email);
        if (!u) return NextResponse.json({ error: "No user with that email" }, { status: 404 });
        const milli = toMilli(Number(body.credits));
        if (!(milli > 0) || milli > toMilli(1_000_000)) return NextResponse.json({ error: "Enter a valid number of credits" }, { status: 400 });
        const ref = `admin:${Date.now()}`;
        const note = String(body.note || (body.action === "grantCredits" ? "Granted by admin" : "Removed by admin"));
        if (body.action === "grantCredits") {
          await grantCredits({ userId: u.id, amountMilli: milli, kind: "admin", ref, note, expireDays: null });
        } else {
          await debitCredits({ userId: u.id, amountMilli: milli, ref, note });
        }
        return NextResponse.json({ ok: true, balanceMilli: await getBalanceMilli(u.id) });
      }

      case "unlockFree": {
        // Opens the free trial again for ONE user: adds N extra free images to their lifetime cap.
        const u = await userByEmail(body.email);
        if (!u) return NextResponse.json({ error: "No user with that email" }, { status: 404 });
        const extra = Math.max(1, Math.min(100, Math.round(Number(body.extra) || 1)));
        await db.billingAccount.upsert({
          where: { userId: u.id },
          create: { userId: u.id, freeBonus: extra },
          update: { freeBonus: { increment: extra } },
        });
        return NextResponse.json({ ok: true, free: await freeTrialStatus(u.id) });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[ADMIN BILLING]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
