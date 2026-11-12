// ============================================================
// UXLLY — Slideshow styles for the picker
//   GET     → ready-made styles + the user's own ("mine": true)
//   POST    { name, textStyle, refs[1-6] } → create the user's own style (the AI studies it once)
//   DELETE  ?id= → remove one of the user's own styles
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUsage } from "@/lib/billing/usage";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { requireUser, unauthorized } from "@/lib/billing/http";
import { listOwnStyles, listStyles } from "@/lib/slideshow/store";
import { studyStyle } from "@/lib/slideshow/dna";
import type { SlideshowStyleRec } from "@/lib/slideshow/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const shape = (s: SlideshowStyleRec, mine: boolean) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  textStyle: s.textStyle,
  formats: s.formats,
  mine,
  cover: s.refs[0] || null,
  preview: s.refs.slice(0, 3),
});

export async function GET() {
  try {
    const user = await requireUser();
    const ready = (await listStyles({ publishedOnly: true })).filter((s) => s.dna).map((s) => shape(s, false));
    const own = user ? (await listOwnStyles(user.id)).map((s) => shape(s, true)) : [];
    return NextResponse.json({ styles: [...own, ...ready] });
  } catch (e) {
    console.error("[SLIDESHOW STYLES] list failed:", e);
    return NextResponse.json({ styles: [] });
  }
}

async function handlePOST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const refs: string[] = Array.isArray(b.refs) ? b.refs.filter((x: unknown): x is string => typeof x === "string" && x.length > 8).slice(0, 6) : [];
  if (!refs.length) return NextResponse.json({ error: "Add at least one example slide." }, { status: 400 });
  if ((await db.slideshowStyle.count({ where: { ownerId: user.id } })) >= 12) return NextResponse.json({ error: "You have 12 styles already. Delete one first." }, { status: 400 });

  let auth;
  try {
    auth = await authorize(user.id, [{ key: "chat.text", qty: 3 }], { trial: "none" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: "Not enough credits to study your examples", code: "insufficient_credits", neededMilli: e.neededMilli }, { status: 402 });
    throw e;
  }
  try {
    const dna = await studyStyle(refs);
    const row = await db.slideshowStyle.create({
      data: {
        name: (typeof b.name === "string" && b.name.trim() ? b.name.trim() : "My slideshow style").slice(0, 80),
        refs,
        dna,
        textStyle: ["white", "dark", "plain"].includes(b.textStyle) ? b.textStyle : "white",
        published: false,
        ownerId: user.id,
      },
    });
    await commit(user.id, auth, [{ key: "chat.text", qty: 3 }], { ref: `sstyle:${row.id}`, note: "Slideshow style: studied examples" }).catch((e) => console.error("[SLIDESHOW STYLES] billing failed:", e));
    return NextResponse.json({ success: true, style: shape(row as unknown as SlideshowStyleRec, true) });
  } catch (e) {
    console.error("[SLIDESHOW STYLES] create failed:", e);
    return NextResponse.json({ error: "Couldn't study the examples. Nothing was charged. Try again." }, { status: 500 });
  }
}
export const POST = withUsage(handlePOST);

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = new URL(request.url).searchParams.get("id") || "";
  await db.slideshowStyle.deleteMany({ where: { id, ownerId: user.id } });
  return NextResponse.json({ success: true });
}
