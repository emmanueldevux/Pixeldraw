// ============================================================
// UXLLY — Posting slots (pure functions, no AI)
// Turns "30 days, 2 a day, Instagram + LinkedIn" into concrete date/time
// slots in the user's timezone, each with a platform and a size.
// ============================================================

export type PlanFormat = "single" | "carousel";
export type PlanSize = "4:5" | "1:1" | "9:16";

export interface Slot {
  index: number;
  scheduledAt: Date; // UTC instant
  localDate: string; // YYYY-MM-DD in the user's timezone
  localTime: string; // HH:MM
  platform: string;
  size: PlanSize;
  carouselOk: boolean;
}

/** Posts per day → local posting times. "few_week" = Mon/Wed/Fri at 10:00. */
export function timesFor(postsPerDay: string): { times: string[]; weekdays?: number[] } {
  switch (postsPerDay) {
    case "few_week":
      return { times: ["10:00"], weekdays: [1, 3, 5] };
    case "2":
      return { times: ["09:00", "18:00"] };
    case "3":
      return { times: ["08:00", "13:00", "19:00"] };
    case "5plus":
      return { times: ["07:30", "10:30", "13:00", "16:00", "19:30"] };
    default:
      return { times: ["10:00"] };
  }
}

/** The UTC instant at which a wall-clock time happens in `timeZone`. */
export function zonedToUtc(localDate: string, localTime: string, timeZone: string): Date {
  const [y, m, d] = localDate.split("-").map(Number);
  const [hh, mm] = localTime.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return new Date(guess - (asUtc - guess));
  } catch {
    return new Date(guess - 3600_000); // Africa/Lagos fallback (UTC+1)
  }
}

export function platformSize(platform: string): { size: PlanSize; carouselOk: boolean } {
  switch (platform) {
    case "tiktok":
    case "youtube":
    case "whatsapp":
    case "snapchat":
      return { size: "9:16", carouselOk: false };
    case "x":
    case "threads":
      return { size: "1:1", carouselOk: false };
    case "pinterest":
      return { size: "4:5", carouselOk: false };
    default: // instagram, facebook, linkedin
      return { size: "4:5", carouselOk: true };
  }
}

export function buildSlots(opts: { startDate: string; days: number; postsPerDay: string; platforms: string[]; timeZone: string; notBefore?: Date }): Slot[] {
  const platforms = opts.platforms.length ? opts.platforms : ["instagram"];
  const { times, weekdays } = timesFor(opts.postsPerDay);
  const slots: Slot[] = [];
  let rr = 0;
  for (let i = 0; i < opts.days; i++) {
    const [y, m, d] = opts.startDate.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d + i));
    if (weekdays && !weekdays.includes(day.getUTCDay())) continue;
    const localDate = day.toISOString().slice(0, 10);
    for (const t of times) {
      const at = zonedToUtc(localDate, t, opts.timeZone);
      if (opts.notBefore && at < opts.notBefore) continue;
      const platform = platforms[rr++ % platforms.length];
      slots.push({ index: slots.length, scheduledAt: at, localDate, localTime: t, platform, ...platformSize(platform) });
    }
  }
  return slots;
}
