// UXLLY — One automation: pause/resume, rename, change times, delete
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function uid() {
  return (await getServerSession(authOptions))?.user?.id ?? null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.isActive === "boolean") data.isActive = b.isActive;
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim().slice(0, 80);
  if (typeof b.prompt === "string" && b.prompt.trim()) data.prompt = b.prompt.trim().slice(0, 2000);
  if (typeof b.schedule === "string" && b.schedule.trim()) data.schedule = b.schedule.trim().slice(0, 120);
  if (typeof b.deliveryEmail === "boolean") data.deliveryEmail = b.deliveryEmail;
  const res = await db.job.updateMany({ where: { id: params.id, userId }, data });
  return res.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_r: Request, { params }: { params: { id: string } }) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.job.deleteMany({ where: { id: params.id, userId } });
  return NextResponse.json({ success: true });
}
