// GET /api/billing/history — the user's credit ledger, newest first.
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { getHistory } from "@/lib/billing/ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  return NextResponse.json({ events: await getHistory(user.id, 200) });
}
