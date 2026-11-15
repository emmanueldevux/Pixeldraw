// POST /api/billing/sync {reference}
// Called by the browser right after Paystack sends the customer back, so credits show up
// immediately even if the webhook is slow. Idempotent — the webhook and this call can never double-grant.
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { paystackConfigured } from "@/lib/billing/paystack";
import { verifyReference } from "@/lib/billing/flows";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!paystackConfigured()) return NextResponse.json({ ok: true });
  try {
    const body = await request.json();
    const status = body.reference ? await verifyReference(String(body.reference), user.id) : "none";
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
