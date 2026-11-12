// ============================================================
// UXLLY — Design templates: database access (server only)
// ============================================================

import { db } from "@/lib/db";
import { uploadImage } from "@/lib/storage";
import { BUILT_IN_TEMPLATES, TEMPLATE_1_NEW_COLOUR_LINE, TEMPLATE_1_OLD_COLOUR_LINE } from "./defaults";
import { pickPack } from "./pack";
import { cleanTemplateInput, isThumbPack, type DesignTemplate, type TemplateParam, type TemplateStyle } from "./types";

type Row = Omit<DesignTemplate, "params" | "styles" | "aspect" | "kind"> & { params: unknown; styles: unknown; aspect: string; kind?: string | null };

function toTemplate(r: Row): DesignTemplate {
  return {
    ...r,
    aspect: (r.aspect as DesignTemplate["aspect"]) || "9:16",
    kind: r.kind === "pack" ? "pack" : "prompt",
    refImages: r.refImages || [],
    packDna: r.packDna || "",
    refDnas: r.refDnas || [],
    params: (Array.isArray(r.params) ? r.params : []) as TemplateParam[],
    styles: (Array.isArray(r.styles) ? r.styles : []) as TemplateStyle[],
  };
}

let seeded = false;
/** Insert any built-in template whose number doesn't exist yet. Never overwrites admin edits. */
export async function ensureSeeded() {
  if (seeded) return;
  for (const t of BUILT_IN_TEMPLATES) {
    const exists = await db.designTemplate.findUnique({ where: { number: t.number } });
    if (!exists) {
      await db.designTemplate.create({ data: { ...t, params: t.params as never, styles: t.styles as never } }).catch(() => {});
    } else if (exists.prompt.includes(TEMPLATE_1_OLD_COLOUR_LINE)) {
      // Brand colours now win over pack colours: swap the line, drop the old param.
      const params = (Array.isArray(exists.params) ? exists.params : []) as { key?: string }[];
      await db.designTemplate
        .update({
          where: { id: exists.id },
          data: {
            prompt: exists.prompt.replace(TEMPLATE_1_OLD_COLOUR_LINE, TEMPLATE_1_NEW_COLOUR_LINE),
            params: params.filter((p) => p.key !== "Pack Colours") as never,
          },
        })
        .catch(() => {});
    }
  }
  seeded = true;
}

export async function listTemplates(opts: { publishedOnly: boolean }): Promise<DesignTemplate[]> {
  await ensureSeeded();
  const rows = (await db.designTemplate.findMany({
    where: opts.publishedOnly ? { published: true, ownerId: null } : { ownerId: null },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
  })) as unknown as Row[];
  return rows.map(toTemplate);
}

export async function getTemplate(id: string): Promise<DesignTemplate | null> {
  await ensureSeeded();
  const r = (await db.designTemplate.findUnique({ where: { id } })) as unknown as Row | null;
  return r ? toTemplate(r) : null;
}

export async function saveTemplate(id: string | null, raw: Record<string, unknown>): Promise<DesignTemplate> {
  const data = cleanTemplateInput(raw);
  const payload = { ...data, params: data.params as never, styles: data.styles as never };
  if (id) {
    return toTemplate((await db.designTemplate.update({ where: { id }, data: payload })) as unknown as Row);
  }
  const last = await db.designTemplate.findFirst({ orderBy: { number: "desc" } });
  return toTemplate((await db.designTemplate.create({ data: { ...payload, number: (last?.number ?? 0) + 1 } })) as unknown as Row);
}

export async function deleteTemplate(id: string) {
  await db.designTemplate.delete({ where: { id } });
}

export async function bumpUsage(id: string) {
  await db.designTemplate.update({ where: { id }, data: { usageCount: { increment: 1 } } }).catch(() => {});
}

/** Store an admin-uploaded cover image (data URL) in R2; falls back to the data URL itself if R2 isn't set up. */
export async function storeCover(dataUrl: string): Promise<string> {
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) throw new Error("Not an image");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 8 * 1024 * 1024) throw new Error("Image is over 8 MB");
  try {
    return await uploadImage(buf, m[1], "templates");
  } catch (e) {
    console.warn("[TEMPLATES] R2 upload failed, keeping image inline:", e);
    if (buf.length > 1.5 * 1024 * 1024) throw new Error("Couldn't upload (storage not set up) and the image is too big to keep inline");
    return dataUrl;
  }
}

/** A user's own private ad packs. */
export async function listOwnPacks(userId: string): Promise<DesignTemplate[]> {
  const rows = (await db.designTemplate.findMany({ where: { ownerId: userId, kind: "pack" }, orderBy: { createdAt: "desc" } })) as unknown as Row[];
  return rows.map(toTemplate).filter((t) => t.refImages.length > 0);
}

/**
 * The pack to use for a single ad.
 *  - a chosen pack id wins (a published pack, or one of the user's own)
 *  - "auto" (no id): if the user made packs of their own, those are used; else the published packs.
 *    With several candidates the AI picks the best one for this request.
 */
export async function resolvePack(
  packId: string | null | undefined,
  ctx: { userId?: string; brief?: string; hint?: string; purpose?: "ad" | "thumbnail" } = {},
): Promise<DesignTemplate | null> {
  const wantThumb = ctx.purpose === "thumbnail";
  const usable = (t: DesignTemplate | null) =>
    !!t && t.kind === "pack" && t.refImages.length > 0 && isThumbPack(t) === wantThumb && ((t.published && !t.ownerId) || (!!ctx.userId && t.ownerId === ctx.userId));
  if (packId) {
    const t = await getTemplate(packId).catch(() => null);
    if (usable(t)) return t;
  }
  const own = (ctx.userId ? await listOwnPacks(ctx.userId).catch(() => []) : []).filter((t) => isThumbPack(t) === wantThumb);
  const pool = own.length ? own : (await listTemplates({ publishedOnly: true })).filter((t) => usable(t));
  if (pool.length <= 1) return pool[0] ?? null;
  return pickPack(pool, ctx.brief || "", ctx.hint || "");
}
