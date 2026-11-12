// UXLLY — GET a background task's progress (carousels)
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTaskView } from "@/lib/carousels/task";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t = await getTaskView(params.id, session.user.id);
  return t ? NextResponse.json({ success: true, data: t }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
