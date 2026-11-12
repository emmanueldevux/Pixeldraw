// ============================================================
// UXLLY Billing — balance (PURE, no DB)
// The balance is DERIVED from the append-only ledger, never stored
// (same rule CrawlGecko uses). On top of that:
//   - grants can expire (purchased credits: 1 year)
//   - spending uses the soonest-expiring credits first
//   - spending more than you hold creates a "deficit" that the next
//     grant pays off first (so a tiny overspend self-heals on top-up)
// ============================================================

export interface LedgerRow {
  deltaMilli: number;
  createdAt: Date | string;
  expiresAt?: Date | string | null;
}

export interface Lot {
  remainingMilli: number;
  expiresAt: number | null; // epoch ms
}

const t = (d: Date | string) => new Date(d).getTime();

export function computeBalance(
  rows: LedgerRow[],
  now: Date = new Date()
): { balanceMilli: number; lots: Lot[]; deficitMilli: number } {
  const sorted = [...rows].sort((a, b) => t(a.createdAt) - t(b.createdAt));
  const lots: Lot[] = [];
  let deficit = 0;

  for (const r of sorted) {
    const at = t(r.createdAt);
    if (r.deltaMilli > 0) {
      let amount = r.deltaMilli;
      if (deficit > 0) {
        const pay = Math.min(deficit, amount);
        deficit -= pay;
        amount -= pay;
      }
      if (amount > 0) {
        lots.push({ remainingMilli: amount, expiresAt: r.expiresAt ? t(r.expiresAt) : null });
      }
    } else if (r.deltaMilli < 0) {
      let need = -r.deltaMilli;
      // Lots still alive at the moment of this debit, soonest-expiring first
      // (never-expiring lots last).
      const eligible = lots
        .filter((l) => l.remainingMilli > 0 && (l.expiresAt === null || l.expiresAt > at))
        .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity));
      for (const lot of eligible) {
        const take = Math.min(lot.remainingMilli, need);
        lot.remainingMilli -= take;
        need -= take;
        if (need === 0) break;
      }
      deficit += need;
    }
  }

  const nowT = now.getTime();
  const live = lots.filter(
    (l) => l.remainingMilli > 0 && (l.expiresAt === null || l.expiresAt > nowT)
  );
  const balanceMilli = live.reduce((s, l) => s + l.remainingMilli, 0) - deficit;
  return { balanceMilli, lots: live, deficitMilli: deficit };
}
