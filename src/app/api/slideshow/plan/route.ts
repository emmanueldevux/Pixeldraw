// ============================================================
// UXLLY — Plan a lifestyle slideshow
// POST { brandId, topic, format, count, characterId?, styleId?, frameSlots? } → { title, slides[] }
// ============================================================
import { NextResponse } from "next/server";
import { withUsage } from "@/lib/billing/usage";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { insufficientResponse, requireUser, unauthorized } from "@/lib/billing/http";
import { planSlideshow } from "@/lib/slideshow/plan";
import { loadContext } from "@/lib/slideshow/context";
import { bumpStyleUsage, resolveStyle } from "@/lib/slideshow/store";
import type { SlideshowFormat } from "@/lib/slideshow/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

async function handlePOST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const topic = typeof b.topic === "string" ? b.topic.trim().slice(0, 600) : "";
  if (!topic) return NextResponse.json({ error: "Tell me what the slideshow is about." }, { status: 400 });
  const format: SlideshowFormat = ["list", "story", "travel", "split"].includes(b.format) ? b.format : "list";
  // No project = a quick slideshow: no saved characters, no brand voice.
  const ctx = typeof b.brandId === "string" && b.brandId ? await loadContext(user.id, b.brandId) : { voice: "", characters: [] };
  if (!ctx) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const character = ctx.characters.find((c) => c.id === b.characterId) || null;
  const style = await resolveStyle(typeof b.styleId === "string" ? b.styleId : null, user.id);

  let auth;
  try {
    auth = await authorize(user.id, [{ key: "chat.text" }], { trial: "none" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return insufficientResponse(e);
    throw e;
  }
  try {
    const plan = await planSlideshow({
      topic,
      format,
      count: Number(b.count) || 6,
      voice: ctx.voice,
      character,
      styleDna: style?.dna || "",
      frameSlots: Math.max(0, Math.min(20, Number(b.frameSlots) || 0)),
    });
    await commit(user.id, auth, [{ key: "chat.text" }], { ref: `slideshow-plan:${Date.now()}`, note: "Slideshow plan" }).catch((e) => console.error("[SLIDESHOW] billing failed:", e));
    if (style) bumpStyleUsage(style.id);
    return NextResponse.json({ success: true, plan, textStyle: style?.textStyle || "white" });
  } catch (e) {
    console.error("[SLIDESHOW] plan failed:", e);
    return NextResponse.json({ error: "Couldn't plan the slideshow. Nothing was charged. Try again." }, { status: 502 });
  }
}
export const POST = withUsage(handlePOST);
