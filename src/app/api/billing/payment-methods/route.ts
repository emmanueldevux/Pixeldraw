// Saved cards: GET list · POST {action:"attach"|"default"} · DELETE ?id=
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { stripeConfigured, getStripe, getOrCreateAccount, stripeMessage } from "@/lib/billing/stripe";
import { listCards, attachSetupIntent, setDefaultPaymentMethod, removeCard } from "@/lib/billing/flows";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!stripeConfigured()) return NextResponse.json({ cards: [] });
  return NextResponse.json({ cards: await listCards(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json();
    if (body.action === "attach") {
      const id = await attachSetupIntent(user.id, String(body.setupIntentId));
      return NextResponse.json({ ok: true, paymentMethodId: id });
    }
    if (body.action === "default") {
      await setDefaultPaymentMethod(user.id, String(body.paymentMethodId));
      const account = await getOrCreateAccount(user.id);
      if (account.stripeSubscriptionId) {
        await getStripe().subscriptions.update(account.stripeSubscriptionId, { default_payment_method: String(body.paymentMethodId) });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: stripeMessage(e) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await removeCard(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: stripeMessage(e) }, { status: 400 });
  }
}
