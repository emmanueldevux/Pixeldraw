// PUT /api/billing/auto-reload {enabled, belowCredits, amountCents}
// When the balance drops below `belowCredits`, we charge the default card `amountCents`.
// If it is off (or the charge fails) the user just sees "out of credits — top up".
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { getOrCreateAccount } from "@/lib/billing/stripe";
import { getSettings } from "@/lib/billing/settings";
import { toMilli } from "@/lib/billing/units";
import { usd } from "@/lib/billing/units";

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const body = await request.json();
  const account = await getOrCreateAccount(user.id);

  if (!body.enabled) {
    await db.billingAccount.update({ where: { userId: user.id }, data: { autoReloadEnabled: false } });
    return NextResponse.json({ ok: true });
  }

  const s = await getSettings();
  const amountCents = Math.round(Number(body.amountCents));
  const belowMilli = toMilli(Number(body.belowCredits));
  if (!account.defaultPaymentMethod) return NextResponse.json({ error: "Add a payment method first" }, { status: 400 });
  if (!Number.isFinite(amountCents) || amountCents < s.autoReloadMinCents || amountCents > s.autoReloadMaxCents) {
    return NextResponse.json({ error: `Reload amount must be between ${usd(s.autoReloadMinCents)} and ${usd(s.autoReloadMaxCents)}` }, { status: 400 });
  }
  if (!Number.isFinite(belowMilli) || belowMilli < 0) {
    return NextResponse.json({ error: "Enter a valid threshold" }, { status: 400 });
  }
  await db.billingAccount.update({
    where: { userId: user.id },
    data: { autoReloadEnabled: true, autoReloadBelowMilli: belowMilli, autoReloadAmountCents: amountCents },
  });
  return NextResponse.json({ ok: true });
}
