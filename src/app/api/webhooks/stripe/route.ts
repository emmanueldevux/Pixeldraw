// Stripe was replaced by Paystack. Kept as a stub so old deploys don't break; safe to delete this file.
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Stripe is no longer used. Webhooks go to /api/webhooks/paystack" }, { status: 410 });
}
