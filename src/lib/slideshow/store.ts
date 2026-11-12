// UXLLY — slideshow styles: database access (server only)
import { db } from "@/lib/db";
import { cleanStyleInput, type SlideshowStyleRec } from "./types";

const rec = (r: unknown) => r as SlideshowStyleRec;

/** Ready-made styles (admin curated). */
export async function listStyles(opts: { publishedOnly: boolean }): Promise<SlideshowStyleRec[]> {
  const rows = await db.slideshowStyle.findMany({
    where: opts.publishedOnly ? { published: true, ownerId: null } : { ownerId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(rec);
}

export async function listOwnStyles(userId: string): Promise<SlideshowStyleRec[]> {
  return (await db.slideshowStyle.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" } })).map(rec);
}

export async function getStyle(id: string): Promise<SlideshowStyleRec | null> {
  const r = await db.slideshowStyle.findUnique({ where: { id } });
  return r ? rec(r) : null;
}

/** A style the user may use: a published admin style or one of their own. */
export async function resolveStyle(id: string | null | undefined, userId: string): Promise<SlideshowStyleRec | null> {
  if (!id) return null;
  const st = await getStyle(id).catch(() => null);
  if (!st) return null;
  if ((st.published && !st.ownerId) || st.ownerId === userId) return st;
  return null;
}

export async function saveStyle(id: string | null, raw: Record<string, unknown>): Promise<SlideshowStyleRec> {
  const data = cleanStyleInput(raw);
  if (id) return rec(await db.slideshowStyle.update({ where: { id }, data }));
  return rec(await db.slideshowStyle.create({ data }));
}

export async function deleteStyle(id: string) {
  await db.slideshowStyle.delete({ where: { id } });
}

export async function bumpStyleUsage(id: string) {
  await db.slideshowStyle.update({ where: { id }, data: { usageCount: { increment: 1 } } }).catch(() => {});
}
