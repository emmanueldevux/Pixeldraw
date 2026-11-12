// ============================================================
// UXLLY — Automation (job) schedules
// Job.schedule is stored as "09:00,17:00@Africa/Lagos" (times, then the
// user's timezone). Older jobs have no "@zone" and are read as UTC.
// A job is "due" when one of today's times has passed and the job hasn't
// run since: so it works with any cron frequency (15-60 min or even daily).
// ============================================================
import { zonedToUtc } from "@/lib/plan/slots";

export interface ParsedSchedule {
  times: string[]; // "HH:MM"
  timeZone: string;
}

export function parseSchedule(schedule: string | null | undefined): ParsedSchedule {
  const [timesPart, zone] = String(schedule || "").split("@");
  const times = timesPart
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    .map((t) => t.padStart(5, "0"));
  return { times: times.length ? times : ["09:00"], timeZone: (zone || "UTC").trim() || "UTC" };
}

export function formatSchedule(times: string[], timeZone: string): string {
  return `${[...new Set(times)].sort().join(",")}@${timeZone}`;
}

function localDate(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** The most recent scheduled instant at or before `now` (today, else yesterday's last time). */
export function lastDueTime(schedule: string, now = new Date()): Date | null {
  const { times, timeZone } = parseSchedule(schedule);
  const today = localDate(now, timeZone);
  const yesterday = localDate(new Date(now.getTime() - 86400000), timeZone);
  const candidates = [...times.map((t) => zonedToUtc(yesterday, t, timeZone)), ...times.map((t) => zonedToUtc(today, t, timeZone))].filter((d) => d <= now).sort((a, b) => +b - +a);
  return candidates[0] || null;
}

export function isJobDue(job: { schedule: string; lastRunAt?: Date | string | null }, now = new Date()): boolean {
  const due = lastDueTime(job.schedule, now);
  if (!due) return false;
  const last = job.lastRunAt ? new Date(job.lastRunAt) : null;
  // Don't fire a brand-new job for a time that passed before it existed: callers pass createdAt as lastRunAt fallback.
  return !last || last < due;
}

/** Occurrences of a job on a local calendar day (for drawing it on the calendar). */
export function occurrencesOn(schedule: string, day: Date): Date[] {
  const { times, timeZone } = parseSchedule(schedule);
  const ymd = localDate(day, timeZone);
  return times.map((t) => zonedToUtc(ymd, t, timeZone));
}
