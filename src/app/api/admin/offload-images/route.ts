// ============================================================
// /api/admin/offload-images — admin-only, one-off clean-up.
// Older projects stored reference images as base64 inside the database, which is
// what burns the database's network transfer. This moves them to file storage and
// keeps only URLs. Call POST { offset } repeatedly until done is true.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/billing/http";
import { persistDataImage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH = 2;

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { offset = 0 } = await request.json().catch(() => ({}));
  const start = Math.max(0, Number(offset) || 0);
  const ids = await db.styleGuide.findMany({ select: { id: true }, orderBy: { id: "asc" }, skip: start, take: BATCH });
  let moved = 0;
  for (const { id } of ids) {
    const row = await db.styleGuide.findUnique({ where: { id }, select: { referenceImages: true, generationPool: true } });
    if (!row) continue;
    const conv = async (v: unknown) => {
      if (!Array.isArray(v)) return { out: v, changed: false };
      let changed = false;
      const out = await Promise.all(
        (v as unknown[]).map(async (x) => {
          if (typeof x === "string" && x.startsWith("data:image/")) {
            const url = await persistDataImage(x, "references");
            if (url !== x) { changed = true; moved++; }
            return url;
          }
          return x;
        })
      );
      return { out, changed };
    };
    const ref = await conv(row.referenceImages);
    const pool = await conv(row.generationPool);
    if (ref.changed || pool.changed) {
      await db.styleGuide.update({
        where: { id },
        data: {
          ...(ref.changed ? { referenceImages: ref.out as never } : {}),
          ...(pool.changed ? { generationPool: pool.out as never } : {}),
        },
      });
    }
  }
  const done = ids.length < BATCH;
  return NextResponse.json({ done, nextOffset: start + ids.length, movedImages: moved });
}
