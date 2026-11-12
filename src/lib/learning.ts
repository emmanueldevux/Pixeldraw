// ============================================================
// UXLLY — Learning loop
// Every saved design records which reference layout made it. What people do
// next is the signal: a download (or marking it posted) is a vote for that
// layout; a redo or a delete is a vote against. When the AI picks a layout
// from a pack, a clearly disliked one is swapped for a better-scoring one.
// Scores are per pack and shared across all users (a layout that keeps
// getting redone is weak everywhere), with a minimum number of signals so
// one unlucky image never buries a good layout.
// ============================================================
import { db } from "@/lib/db";

export type RefScores = Record<number, { score: number; n: number }>;

const MIN_SIGNALS = 4; // designs from one layout before its score counts

/** Net score per reference index of a pack, from how its designs were treated. */
export async function packRefScores(packId: string): Promise<RefScores> {
  try {
    const rows = await db.generation.findMany({
      where: { meta: { path: ["pack", "id"], equals: packId } },
      select: { meta: true, downloads: true, redos: true, deleted: true },
      orderBy: { createdAt: "desc" },
      take: 600,
    });
    const out: RefScores = {};
    for (const r of rows) {
      const idx = Number(((r.meta as { pack?: { refIndex?: number } } | null)?.pack?.refIndex));
      if (!Number.isInteger(idx)) continue;
      const e = (out[idx] ||= { score: 0, n: 0 });
      e.n += 1;
      e.score += Math.min(r.downloads, 3) * 2 - Math.min(r.redos, 3) * 2 - (r.deleted ? 3 : 0);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Keep the AI's pick unless it is a proven loser (enough signals, negative
 * average) AND another layout has a clearly better record.
 */
export function adjustPick(pick: number, n: number, scores: RefScores): number {
  const avg = (i: number) => (scores[i] && scores[i].n >= MIN_SIGNALS ? scores[i].score / scores[i].n : null);
  const mine = avg(pick);
  if (mine === null || mine >= -0.5) return pick;
  let best = pick;
  let bestAvg = mine;
  for (let i = 0; i < n; i++) {
    const a = avg(i);
    if (a !== null && a > bestAvg + 1) {
      best = i;
      bestAvg = a;
    }
  }
  return best;
}
