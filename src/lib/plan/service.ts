// ============================================================
// UXLLY — Content plan service
//   createPlanDraft   wizard / chat → draft items on the calendar (free)
//   approvePlan       user reviewed → items become "approved"
//   runPlanCycle      cron: generate ~24h ahead, email at slot time
// ============================================================
import { db } from "@/lib/db";
import { buildSlots } from "./slots";
import { draftPlanItems } from "./draft";
import { produceItem } from "./produce";
import { sendPlanItemEmail, sendPlanProblemEmail } from "@/lib/delivery/email";
import { authorize, commit, meterFollowUp, InsufficientCreditsError } from "@/lib/billing/meter";

const MAX_ITEMS = 90;
const GENERATE_AHEAD_MS = 26 * 3600_000; // start making a post ~a day before its slot
const PER_RUN = 3; // posts made per cron run (keeps each run inside its time limit)

export interface PlanInput {
  userId: string;
  brandId: string;
  startDate: string; // YYYY-MM-DD in the user's timezone
  days: number;
  platforms: string[];
  postsPerDay: string;
  goals: string[];
  brief?: string;
  timezone?: string;
  carouselShare?: number;
}

export async function createPlanDraft(input: PlanInput) {
  const brand = await db.brand.findFirst({ where: { id: input.brandId, userId: input.userId }, include: { styleGuide: true } });
  if (!brand) throw new Error("Project not found");
  const tz = input.timezone || "Africa/Lagos";
  const days = Math.min(60, Math.max(1, Math.round(input.days) || 30));
  let slots = buildSlots({ startDate: input.startDate, days, postsPerDay: input.postsPerDay || "1", platforms: input.platforms, timeZone: tz, notBefore: new Date(Date.now() + 3600_000) });
  const trimmed = slots.length > MAX_ITEMS;
  slots = slots.slice(0, MAX_ITEMS).map((s, i) => ({ ...s, index: i }));
  if (slots.length === 0) throw new Error("No posting slots in that range");

  const language = ((brand.styleGuide as unknown as { advancedSettings?: { language?: string } } | null)?.advancedSettings?.language) || undefined;
  await authorize(input.userId, [{ key: "chat.text", qty: Math.ceil(slots.length / 24) + 1 }], { trial: "none" }); // balance check
  const mark = meterFollowUp(input.userId);
  const items = await draftPlanItems({ brandId: brand.id, brandName: brand.name, slots, goals: input.goals, brief: input.brief, language, carouselShare: input.carouselShare });
  await commit(input.userId, mark, [{ key: "chat.text", qty: Math.ceil(slots.length / 24) }], { ref: `plan-draft:${Date.now()}`, note: `Content plan draft (${slots.length} posts)` }).catch((e) => console.error("[PLAN] billing failed:", e));

  const last = slots[slots.length - 1];
  const plan = await db.contentPlan.create({
    data: {
      userId: input.userId,
      brandId: brand.id,
      title: `${days}-day plan · ${brand.name}`,
      startDate: slots[0].scheduledAt,
      endDate: last.scheduledAt,
      platforms: input.platforms,
      postsPerDay: input.postsPerDay || "1",
      goals: input.goals,
      brief: input.brief || null,
      timezone: tz,
      status: "draft",
      items: {
        create: items.map((it) => ({
          userId: input.userId,
          brandId: brand.id,
          scheduledAt: it.slot.scheduledAt,
          platform: it.slot.platform,
          format: it.format,
          size: it.slot.size,
          topic: it.topic,
          theme: it.theme || null,
          status: "draft",
        })),
      },
    },
    include: { items: { orderBy: { scheduledAt: "asc" } } },
  });
  return { plan, trimmed };
}

export async function approvePlan(planId: string, userId: string) {
  const plan = await db.contentPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) throw new Error("Plan not found");
  const res = await db.planItem.updateMany({ where: { planId, userId, status: "draft", scheduledAt: { gt: new Date() } }, data: { status: "approved" } });
  await db.contentPlan.update({ where: { id: planId }, data: { status: "approved" } });
  return res.count;
}

const appUrl = () => (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

function whenLabel(d: Date, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  } catch {
    return d.toUTCString();
  }
}

/** Cron entry: make what's due, send what's ready. Safe to run every 15-60 minutes. */
export async function runPlanCycle() {
  const now = new Date();
  const out = { generated: 0, sent: 0, failed: 0 };

  // 1) Generate posts whose slot is within ~26h (oldest slot first).
  const due = await db.planItem.findMany({
    where: { status: "approved", scheduledAt: { lte: new Date(now.getTime() + GENERATE_AHEAD_MS) } },
    orderBy: { scheduledAt: "asc" },
    take: PER_RUN,
    include: { plan: true },
  });
  for (const item of due) {
    // claim it so two overlapping runs never make the same post
    const claimed = await db.planItem.updateMany({ where: { id: item.id, status: "approved" }, data: { status: "generating" } });
    if (claimed.count === 0) continue;
    const alreadyWarned = !!item.error; // don't email the same out-of-credits warning every run
    try {
      const r = await produceItem(item.id);
      await db.planItem.update({
        where: { id: item.id },
        data: { status: "ready", imageUrls: r.imageUrls, caption: r.caption, hashtags: r.hashtags, generationId: r.generationId, generatedAt: new Date(), error: null },
      });
      out.generated++;
    } catch (e) {
      const noCredits = e instanceof InsufficientCreditsError;
      const reason = noCredits ? "You're out of credits, so this post could not be made. Top up and it will be made on the next run." : `Something went wrong making this post (${(e as Error).message.slice(0, 160)}).`;
      // no credits: put it back so it retries after a top-up; real errors: mark failed
      await db.planItem.update({ where: { id: item.id }, data: { status: noCredits ? "approved" : "failed", error: reason } });
      out.failed++;
      const user = await db.user.findUnique({ where: { id: item.userId }, select: { email: true } });
      if (user?.email && !alreadyWarned) {
        const brand = await db.brand.findUnique({ where: { id: item.brandId }, select: { name: true } });
        await sendPlanProblemEmail({ to: user.email, brandName: brand?.name || "Your project", whenLabel: whenLabel(item.scheduledAt, item.plan.timezone), reason, calendarUrl: `${appUrl()}/calendar` }).catch(() => {});
      }
    }
  }

  // 2) Email posts whose time has come.
  const ready = await db.planItem.findMany({
    where: { status: "ready", scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "asc" },
    take: 20,
    include: { plan: true },
  });
  for (const item of ready) {
    const claimed = await db.planItem.updateMany({ where: { id: item.id, status: "ready" }, data: { status: "sent", sentAt: new Date() } });
    if (claimed.count === 0) continue;
    const user = await db.user.findUnique({ where: { id: item.userId }, select: { email: true } });
    const brand = await db.brand.findUnique({ where: { id: item.brandId }, select: { name: true } });
    if (!user?.email) continue;
    try {
      await sendPlanItemEmail({
        to: user.email,
        brandName: brand?.name || "Your project",
        platform: item.platform,
        whenLabel: whenLabel(item.scheduledAt, item.plan.timezone),
        imageUrls: item.imageUrls,
        caption: item.caption || "",
        hashtags: item.hashtags,
        postedUrl: `${appUrl()}/api/plans/posted?token=${item.token}`,
        calendarUrl: `${appUrl()}/calendar`,
      });
      out.sent++;
    } catch (e) {
      console.error("[PLAN] email failed:", e);
      await db.planItem.update({ where: { id: item.id }, data: { status: "ready", sentAt: null } }); // retry next run
    }
  }
  return out;
}
