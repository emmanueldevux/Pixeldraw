// ============================================================
// UXLLY — Dates worth posting about (Nigeria + global)
// Fixed-date occasions plus Easter (computed). Moving religious dates
// (Eid, Ramadan) are left to the AI, which is told to add any that fall
// in the range. Keep this list short and relevant to social posting.
// ============================================================
export interface Occasion {
  date: string; // YYYY-MM-DD
  name: string;
  kind: "nigeria" | "global" | "retail";
}

function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Black Friday = day after US Thanksgiving (4th Thursday of November). */
function blackFriday(year: number): Date {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstThu = 1 + ((4 - first + 7) % 7);
  return new Date(Date.UTC(year, 10, firstThu + 21 + 1));
}

export function occasionsForYear(year: number): Occasion[] {
  const e = easter(year);
  const list: Occasion[] = [
    { date: `${year}-01-01`, name: "New Year's Day", kind: "global" },
    { date: `${year}-02-14`, name: "Valentine's Day", kind: "global" },
    { date: `${year}-03-08`, name: "International Women's Day", kind: "global" },
    { date: iso(addDays(e, -2)), name: "Good Friday", kind: "nigeria" },
    { date: iso(addDays(e, 1)), name: "Easter Monday", kind: "nigeria" },
    { date: `${year}-05-01`, name: "Workers' Day", kind: "nigeria" },
    { date: `${year}-05-27`, name: "Children's Day (Nigeria)", kind: "nigeria" },
    { date: `${year}-06-12`, name: "Democracy Day (Nigeria)", kind: "nigeria" },
    { date: `${year}-10-01`, name: "Nigeria Independence Day", kind: "nigeria" },
    { date: `${year}-10-31`, name: "Halloween", kind: "global" },
    { date: iso(blackFriday(year)), name: "Black Friday", kind: "retail" },
    { date: iso(addDays(blackFriday(year), 3)), name: "Cyber Monday", kind: "retail" },
    { date: `${year}-12-24`, name: "Christmas Eve", kind: "global" },
    { date: `${year}-12-25`, name: "Christmas Day", kind: "global" },
    { date: `${year}-12-26`, name: "Boxing Day", kind: "nigeria" },
    { date: `${year}-12-31`, name: "New Year's Eve", kind: "global" },
  ];
  // Mother's Day (UK/NG-style: 4th Sunday of Lent) is Easter - 21 days; US Mother's Day = 2nd Sunday of May.
  list.push({ date: iso(addDays(e, -21)), name: "Mother's Day (Mothering Sunday)", kind: "global" });
  const may1 = new Date(Date.UTC(year, 4, 1)).getUTCDay();
  list.push({ date: iso(new Date(Date.UTC(year, 4, 1 + ((7 - may1) % 7) + 7))), name: "Mother's Day (US)", kind: "global" });
  const jun1 = new Date(Date.UTC(year, 5, 1)).getUTCDay();
  list.push({ date: iso(new Date(Date.UTC(year, 5, 1 + ((7 - jun1) % 7) + 14))), name: "Father's Day", kind: "global" });
  return list;
}

export function occasionsBetween(start: Date, end: Date): Occasion[] {
  const years = new Set<number>();
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) years.add(y);
  const s = iso(start), e = iso(end);
  return [...years].flatMap(occasionsForYear).filter((o) => o.date >= s && o.date <= e).sort((a, b) => a.date.localeCompare(b.date));
}
