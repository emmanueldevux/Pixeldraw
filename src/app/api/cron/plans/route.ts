// ============================================================
// UXLLY — Content plan cron
// Makes posts due within ~a day and emails the ones whose time has come.
// Run every 15-30 minutes (vercel.json or any external pinger):
//   GET /api/cron/plans   with header  Authorization: Bearer <CRON_SECRET>
// ============================================================
import { NextResponse } from "next/server";
import { runPlanCycle } from "@/lib/plan/service";
import { resumeAbandonedTasks } from "@/lib/carousels/task";
import { withUsage } from "@/lib/billing/usage";
import { GET as runJobs } from "../route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handleGET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await resumeAbandonedTasks(1).catch(() => {});
    const result = await runPlanCycle();
    // Recurring automations (jobs) whose time has come run from the same ping.
    const jobsRes = await runJobs(request).then((r) => r.json()).catch(() => null);
    return NextResponse.json({ success: true, ...result, jobs: jobsRes?.results ?? [] });
  } catch (e) {
    console.error("[CRON/PLANS] failed:", e);
    return NextResponse.json({ error: "Plan cron failed" }, { status: 500 });
  }
}
export const GET = withUsage(handleGET);
