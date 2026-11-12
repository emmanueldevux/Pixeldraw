// ============================================================
// UXLLY — Carousel styles: database access (server only)
// ============================================================
import { db } from "@/lib/db";
import { cleanStyleInput, isUsable, type CarouselStyle } from "./types";

export async function listStyles(opts: { publishedOnly: boolean }): Promise<CarouselStyle[]> {
  return (await db.carouselStyle.findMany({
    where: opts.publishedOnly ? { published: true, ownerId: null } : { ownerId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })) as unknown as CarouselStyle[];
}

export async function getStyle(id: string): Promise<CarouselStyle | null> {
  return (await db.carouselStyle.findUnique({ where: { id } })) as unknown as CarouselStyle | null;
}

/** A user's own styles (private to them). */
export async function listOwnStyles(userId: string): Promise<CarouselStyle[]> {
  return (await db.carouselStyle.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" } })) as unknown as CarouselStyle[];
}

/**
 * The project's chosen style: a published admin style, or one of the user's own.
 * Falls back to the first usable published style.
 */
export async function resolveStyle(styleId: string | null | undefined, userId?: string): Promise<CarouselStyle | null> {
  if (styleId) {
    const st = await getStyle(styleId);
    if (st && isUsable(st) && ((st.published && !st.ownerId) || (userId && st.ownerId === userId))) return st;
  }
  const all = await listStyles({ publishedOnly: true });
  return all.find(isUsable) ?? null;
}

export async function saveStyle(id: string | null, raw: Record<string, unknown>): Promise<CarouselStyle> {
  const data = cleanStyleInput(raw);
  const row = id ? await db.carouselStyle.update({ where: { id }, data }) : await db.carouselStyle.create({ data });
  return row as unknown as CarouselStyle;
}

export async function deleteStyle(id: string) {
  await db.carouselStyle.delete({ where: { id } });
}

export async function bumpStyleUsage(id: string) {
  await db.carouselStyle.update({ where: { id }, data: { usageCount: { increment: 1 } } }).catch(() => {});
}
