// Stripe was replaced by Paystack. Kept as a stub so old deploys don't break; safe to delete this file.
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Cards are saved automatically when you pay with Paystack." }, { status: 410 });
}
