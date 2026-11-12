// UXLLY — run the next round of a background task (carousels)
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runCarouselStep } from "@/lib/carousels/task";
import { withUsage } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handlePOST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t = await runCarouselStep(params.id, session.user.id);
  return t ? NextResponse.json({ success: true, data: t }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Every AI call in this request is measured for real-cost billing.
export const POST = withUsage(handlePOST);
