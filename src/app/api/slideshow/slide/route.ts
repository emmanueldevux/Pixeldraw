// ============================================================
// UXLLY — Render one slideshow photo
// POST { brandId, scene, person, characterId?, styleId?, landscape?, aspect? } → { url }
// One call per photo keeps every request short (no timeouts) and bills only what rendered.
// ============================================================
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withUsage } from "@/lib/billing/usage";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { insufficientResponse, requireUser, unauthorized } from "@/lib/billing/http";
import { renderPhoto } from "@/lib/slideshow/render";
import { finishHalf, finishSlide } from "@/lib/slideshow/finish";
import { loadContext } from "@/lib/slideshow/context";
import { resolveStyle } from "@/lib/slideshow/store";
import { persistImage } from "@/lib/generations";
import { viewUrl } from "@/lib/slideshow/view";
import type { SlideshowAspect } from "@/lib/slideshow/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handlePOST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const scene = typeof b.scene === "string" ? b.scene.trim().slice(0, 900) : "";
  if (!scene) return NextResponse.json({ error: "Missing scene" }, { status: 400 });
  const ctx = typeof b.brandId === "string" && b.brandId ? await loadContext(user.id, b.brandId) : { voice: "", characters: [] };
  if (!ctx) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const person = b.person === "character" || b.person === "none" ? b.person : "anonymous";
  const character = ctx.characters.find((c) => c.id === b.characterId) || null;
  const style = await resolveStyle(typeof b.styleId === "string" ? b.styleId : null, user.id);
  const landscape = b.landscape === true;
  const aspect: SlideshowAspect = b.aspect === "9:16" ? "9:16" : "3:4";
  const useChar = person === "character" && !!character;

  let auth;
  try {
    auth = await authorize(user.id, [{ key: useChar ? "image.edit" : "image.openai" }], { trial: "consume" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return insufficientResponse(e);
    throw e;
  }
  try {
    const raw = await renderPhoto({ scene, person, character, styleDna: style?.dna || "", landscape });
    const finished = landscape ? await finishHalf(raw.url) : await finishSlide(raw.url, aspect);
    const url = await persistImage(finished, "slideshow");
    const c = await commit(user.id, auth, [{ key: useChar ? "image.edit" : "image.openai" }], { ref: randomUUID(), producedImage: true, note: "Slideshow photo" }).catch((e) => {
      console.error("[SLIDESHOW] billing failed:", e);
      return null;
    });
    return NextResponse.json({ success: true, url, viewUrl: viewUrl(url), chargedMilli: c?.chargedMilli ?? 0 });
  } catch (e) {
    console.error("[SLIDESHOW] render failed:", e);
    return NextResponse.json({ error: "This photo couldn't be made. You were not charged." }, { status: 502 });
  }
}
export const POST = withUsage(handlePOST);
