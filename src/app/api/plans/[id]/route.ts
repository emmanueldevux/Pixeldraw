// UXLLY — One plan
//   GET                         → plan + items
//   POST { action: "approve" }  → drafts become approved (generation starts a day before each slot)
//   PATCH { itemId, ...fields } → edit an item (topic, date, format, platform, size, skip)
//   DELETE ?itemId=             → remove an item; no itemId removes the whole plan
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvePlan } from "@/lib/plan/service";

export const dynamic = "force-dynamic";

async function uid() {
  return (await getServerSession(authOptions))?.user?.id ?? null;
}

export async function GET(_r: Request, { params }: { params: { id: string } }) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plan = await db.contentPlan.findFirst({ where: { id: params.id, userId }, include: { items: { orderBy: { scheduledAt: "asc" } } } });
  return plan ? NextResponse.json({ success: true, data: plan }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (b.action !== "approve") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const count = await approvePlan(params.id, userId);
    return NextResponse.json({ success: true, approved: count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

const EDITABLE_STATUS = ["draft", "approved", "failed"]; // never touch an item that is generating/ready/sent

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const item = await db.planItem.findFirst({ where: { id: String(b.itemId || ""), planId: params.id, userId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data: Record<string, unknown> = {};
  if (b.skip === true && item.status !== "posted") data.status = "skipped";
  if (b.skip === false && item.status === "skipped") data.status = "draft";
  if (b.posted === true) {
    data.status = "posted";
    data.postedAt = new Date();
  }
  if (EDITABLE_STATUS.includes(item.status)) {
    if (typeof b.topic === "string" && b.topic.trim()) data.topic = b.topic.trim().slice(0, 600);
    if (b.format === "single" || b.format === "carousel") data.format = b.format;
    if (["4:5", "1:1", "9:16"].includes(b.size)) data.size = b.size;
    if (typeof b.platform === "string") data.platform = b.platform.slice(0, 20);
    if (typeof b.scheduledAt === "string" && !isNaN(Date.parse(b.scheduledAt))) data.scheduledAt = new Date(b.scheduledAt);
    if (item.status === "failed" && data.topic === undefined && b.retry === true) {
      data.status = "approved";
      data.error = null;
    }
  }
  const updated = await db.planItem.update({ where: { id: item.id }, data });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const itemId = new URL(request.url).searchParams.get("itemId");
  if (itemId) await db.planItem.deleteMany({ where: { id: itemId, planId: params.id, userId, status: { in: EDITABLE_STATUS.concat("skipped") } } });
  else {
    await db.planItem.deleteMany({ where: { planId: params.id, userId, status: { in: EDITABLE_STATUS.concat("skipped") } } });
    await db.contentPlan.deleteMany({ where: { id: params.id, userId, items: { none: {} } } });
  }
  return NextResponse.json({ success: true });
}
