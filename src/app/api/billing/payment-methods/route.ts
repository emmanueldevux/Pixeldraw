// Saved cards: GET list · POST {action:"default", paymentMethodId} · DELETE ?id=
// Cards are saved automatically when a customer pays by card on Paystack.
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { listCards, setDefaultPaymentMethod, removeCard } from "@/lib/billing/flows";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  return NextResponse.json({ cards: await listCards(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json();
    if (body.action === "default") {
      await setDefaultPaymentMethod(user.id, String(body.paymentMethodId));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
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
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
