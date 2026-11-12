// ============================================================
// UXLLY Billing — units
// Credits are stored as integer "milli-credits" (1 credit = 1000) so
// fractional prices like 0.2 credits per chat reply never hit float math.
// ============================================================

export const MILLI = 1000;

export const toMilli = (credits: number) => Math.round(credits * MILLI);
export const fromMilli = (milli: number) => milli / MILLI;

/** "200", "1,250", "0.2", "12.35" */
export function formatCredits(milli: number): string {
  const c = milli / MILLI;
  return Number.isInteger(c)
    ? c.toLocaleString("en-US")
    : c.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** USD cents -> milli-credits, given what ONE credit costs in cents (default 10 = $0.10). */
export function centsToMilli(cents: number, creditValueCents: number): number {
  return Math.round((cents * MILLI) / creditValueCents);
}

/** milli-credits -> USD cents. */
export function milliToCents(milli: number, creditValueCents: number): number {
  return Math.round((milli * creditValueCents) / MILLI);
}

export const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
