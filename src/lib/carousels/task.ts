// ============================================================
// UXLLY — Carousels as background tasks
//
// A carousel takes minutes; one request would time out on Vercel. So:
//   1. /api/ai/carousel plans it (fast) and creates a Task
//   2. /api/tasks/:id/step renders the next round (≈1-2 min each):
//        round 1 = intro + first details + outro (parallel)
//        round 2 = the remaining details (parallel, anchored to the first)
//   3. When done, the carousel is saved to Generations.
// The browser calls step until done; the cron also finishes tasks a user
// walked away from. Each step bills what it really used.
// ============================================================
import { db } from "@/lib/db";
import { getStyle } from "./store";
import { renderStyledSlide, roundSlides, type BrandColours, type GeneratedStyledSlide, type RefChoice, type RenderContext } from "./generate";
import type { StyledPlan } from "./planner";
import type { CarouselSize, SlideImage } from "./types";
import { persistImage, saveGeneration } from "@/lib/generations";
import { commit, meterFollowUp } from "@/lib/billing/meter";
import type { LogoPosition } from "@/lib/ai/logoComposite";

export interface CarouselTaskInput {
  brandId: string;
  styleId: string;
  styleName: string;
  plan: StyledPlan;
  refs: RefChoice;
  size: CarouselSize;
  colours: BrandColours;
  userImages: SlideImage[]; // stored as URLs, never raw image data
  logoUrl: string | null;
  logoPlacement: { position: LogoPosition; scale: number } | null;
  topic: string;
}

export interface CarouselTaskResult {
  round: 0 | 1 | 2;
  slides: GeneratedStyledSlide[];
  generationId?: string | null;
}

export interface TaskView {
  id: string;
  status: string;
  progress: number;
  total: number;
  slides: GeneratedStyledSlide[];
  error: string | null;
  generationId?: string | null;
  style?: string;
  size?: string;
}

type TaskRow = { id: string; userId: string; status: string; progress: number; total: number; input: unknown; result: unknown; error: string | null };

export function view(t: TaskRow): TaskView {
  const input = t.input as CarouselTaskInput;
  const result = (t.result as CarouselTaskResult | null) || { round: 0, slides: [] };
  return {
    id: t.id,
    status: t.status,
    progress: t.progress,
    total: t.total,
    slides: [...result.slides].sort((a, b) => a.slideNumber - b.slideNumber),
    error: t.error,
    generationId: result.generationId ?? null,
    style: input?.styleName,
    size: input?.size,
  };
}

export async function createCarouselTask(userId: string, input: Omit<CarouselTaskInput, "userImages"> & { userImages: SlideImage[] }) {
  // Keep the database light: user images go to storage first.
  const userImages = await Promise.all(input.userImages.map(async (u) => ({ ...u, dataUrl: await persistImage(u.dataUrl, "uploads") })));
  const row = await db.task.create({
    data: {
      userId,
      kind: "carousel",
      status: "running",
      progress: 0,
      total: input.plan.slides.length,
      input: { ...input, userImages } as never,
      result: { round: 0, slides: [] } as never,
    },
  });
  return view(row as unknown as TaskRow);
}

export async function getTaskView(id: string, userId: string): Promise<TaskView | null> {
  const t = await db.task.findFirst({ where: { id, userId } });
  return t ? view(t as unknown as TaskRow) : null;
}

/**
 * Run the next round. Safe to call repeatedly or concurrently: only one
 * caller gets the lock; others just get the current state back.
 */
export async function runCarouselStep(id: string, userId: string): Promise<TaskView | null> {
  const now = new Date();
  const staleLock = new Date(now.getTime() - 5 * 60_000);
  const claimed = await db.task.updateMany({
    where: { id, userId, status: "running", OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }] },
    data: { lockedAt: now },
  });
  const t = (await db.task.findFirst({ where: { id, userId } })) as unknown as TaskRow | null;
  if (!t) return null;
  if (claimed.count === 0) return view(t);

  try {
    const input = t.input as CarouselTaskInput;
    const result = ((t.result as CarouselTaskResult | null) || { round: 0, slides: [] }) as CarouselTaskResult;
    const style = await getStyle(input.styleId);
    if (!style) throw new Error("This carousel style no longer exists");
    const ctx: RenderContext = {
      style,
      refs: input.refs,
      size: input.size,
      colours: input.colours,
      total: input.plan.slides.length,
      userImages: input.userImages,
      logoUrl: input.logoUrl,
      logoPlacement: input.logoPlacement,
    };

    const round = (result.round + 1) as 1 | 2;
    const todo = roundSlides(input.plan, round);
    const anchor = round === 2 ? result.slides.find((s) => s.role === "details" && s.imageUrl)?.imageUrl : undefined;
    const auth = meterFollowUp(userId);
    const rendered = await Promise.all(
      todo.map(async (sl) => {
        const r = await renderStyledSlide(ctx, sl, anchor);
        return { ...r, imageUrl: r.imageUrl ? await persistImage(r.imageUrl, "carousels") : "" };
      }),
    );
    const ok = rendered.filter((r) => r.imageUrl).length;
    if (ok > 0) {
      await commit(userId, auth, [{ key: "image.edit", qty: ok }], { ref: `task:${id}:r${round}`, note: `Carousel (${input.styleName}) round ${round}: ${ok} slides` }).catch((e) =>
        console.error("[TASK] billing failed:", e),
      );
    }

    const slides = [...result.slides.filter((s) => !rendered.some((r) => r.slideNumber === s.slideNumber)), ...rendered];
    const done = round === 2 || roundSlides(input.plan, 2).length === 0;
    let generationId: string | null = null;
    if (done) {
      const ordered = [...slides].sort((a, b) => a.slideNumber - b.slideNumber);
      generationId = (
        await saveGeneration({
          userId,
          brandId: input.brandId,
          kind: "carousel",
          title: input.topic.slice(0, 120),
          imageUrls: ordered.map((s) => s.imageUrl).filter(Boolean),
          caption: null,
          meta: { styleId: input.styleId, size: input.size, refs: input.refs, planSlides: input.plan.slides },
        })
      ).id;
    }
    const updated = await db.task.update({
      where: { id },
      data: {
        result: { round, slides, generationId } as never,
        progress: slides.filter((s) => s.imageUrl).length,
        status: done ? (slides.some((s) => s.imageUrl) ? "done" : "failed") : "running",
        error: done && !slides.some((s) => s.imageUrl) ? "No slides could be generated" : null,
        lockedAt: null,
      },
    });
    return view(updated as unknown as TaskRow);
  } catch (e) {
    console.error("[TASK] step failed:", e);
    const updated = await db.task.update({ where: { id }, data: { status: "failed", error: (e as Error).message, lockedAt: null } });
    return view(updated as unknown as TaskRow);
  }
}

/** Cron: finish carousels whose user left mid-way (idle > 2 min). */
export async function resumeAbandonedTasks(limit = 2) {
  const idle = new Date(Date.now() - 2 * 60_000);
  const tasks = await db.task.findMany({
    where: { kind: "carousel", status: "running", updatedAt: { lt: idle }, OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 5 * 60_000) } }] },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
  const out = [];
  for (const t of tasks) out.push(await runCarouselStep(t.id, t.userId));
  return out;
}
