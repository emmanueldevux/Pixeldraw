// POST /api/billing/topup {amountCents, paymentMethodId?}
// The server validates the amount against admin settings and computes the credits.
// Returns {status:"succeeded"} (saved card charged) or {status:"redirect", url} (Paystack checkout).
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { paystackConfigured } from "@/lib/billing/paystack";
import { createTopUp } from "@/lib/billing/flows";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!paystackConfigured()) return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });
  try {
    const body = await request.json();
    const result = await createTopUp({
      userId: user.id,
      amountCents: Number(body.amountCents),
      paymentMethodId: body.paymentMethodId || undefined,
      origin: new URL(request.url).origin,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
