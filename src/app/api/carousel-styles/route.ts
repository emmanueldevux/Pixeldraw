// ============================================================
// UXLLY — Carousel styles for the Project settings picker
//   GET     → ready-made (published) styles + the user's own ("mine": true)
//   POST    { name, introRefs, detailsRefs, outroRefs }  → create the user's own style;
//           the AI studies each slot's references and writes its design DNA
//   DELETE  ?id=   → remove one of the user's own styles
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { listOwnStyles, listStyles } from "@/lib/carousels/store";
import { isUsable, type CarouselStyle } from "@/lib/carousels/types";
import { studySlot } from "@/lib/carousels/dna";
import { withUsage } from "@/lib/billing/usage";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const shape = (s: CarouselStyle, mine: boolean) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  mine,
  cover: s.introRefs[0] || null,
  preview: [s.introRefs[0], s.detailsRefs[0], s.outroRefs[0]].filter(Boolean),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const ready = (await listStyles({ publishedOnly: true })).filter(isUsable).map((s) => shape(s, false));
    const own = session?.user?.id ? (await listOwnStyles(session.user.id)).filter(isUsable).map((s) => shape(s, true)) : [];
    return NextResponse.json({ styles: [...own, ...ready] });
  } catch (e) {
    console.error("[CAROUSEL STYLES] list failed:", e);
    return NextResponse.json({ styles: [] });
  }
}

const urls = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 8).slice(0, 4) : []);

async function handlePOST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const b = await request.json().catch(() => ({}));
  const introRefs = urls(b.introRefs), detailsRefs = urls(b.detailsRefs), outroRefs = urls(b.outroRefs);
  if (!introRefs.length || !detailsRefs.length || !outroRefs.length) {
    return NextResponse.json({ error: "Add at least one reference for the first, middle and last slide." }, { status: 400 });
  }
  if ((await db.carouselStyle.count({ where: { ownerId: userId } })) >= 12) {
    return NextResponse.json({ error: "You have 12 styles already. Delete one first." }, { status: 400 });
  }

  let auth;
  try {
    auth = await authorize(userId, [{ key: "chat.text", qty: 3 }], { trial: "none" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: "Not enough credits to study your references", code: "insufficient_credits", neededMilli: e.neededMilli }, { status: 402 });
    throw e;
  }

  try {
    const [introDna, detailsDna, outroDna] = await Promise.all([studySlot("intro", introRefs), studySlot("details", detailsRefs), studySlot("outro", outroRefs)]);
    const row = await db.carouselStyle.create({
      data: {
        name: (typeof b.name === "string" && b.name.trim() ? b.name.trim() : "My style").slice(0, 80),
        description: "",
        published: false,
        ownerId: userId,
        introRefs, introDna, detailsRefs, detailsDna, outroRefs, outroDna,
      },
    });
    await commit(userId, auth, [{ key: "chat.text", qty: 3 }], { ref: `style:${row.id}`, note: "Carousel style: studied references" }).catch((e) => console.error("[STYLES] billing failed:", e));
    return NextResponse.json({ success: true, style: shape(row as unknown as CarouselStyle, true) });
  } catch (e) {
    console.error("[CAROUSEL STYLES] create failed:", e);
    return NextResponse.json({ error: "Could not study the references. Nothing was charged. Try again." }, { status: 500 });
  }
}
export const POST = withUsage(handlePOST);

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  await db.carouselStyle.deleteMany({ where: { id, ownerId: session.user.id } });
  return NextResponse.json({ success: true });
}
