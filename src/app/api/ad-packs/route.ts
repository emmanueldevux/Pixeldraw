// ============================================================
// UXLLY — Ad packs for the Project settings picker (single post ads)
//   GET     → ready-made packs + the user's own ("mine": true)
//   POST    { name, refs[1-8] } → create the user's own private pack; the AI studies it once
//   DELETE  ?id= → remove one of the user's own packs
// ============================================================
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { listOwnPacks, listTemplates } from "@/lib/designTemplates/store";
import { studyPack } from "@/lib/designTemplates/pack";
import { withUsage } from "@/lib/billing/usage";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import type { DesignTemplate } from "@/lib/designTemplates/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const shape = (t: DesignTemplate, mine: boolean) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  mine,
  coverImages: (t.coverImages.length ? t.coverImages : t.refImages).slice(0, 4),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const ready = (await listTemplates({ publishedOnly: true })).filter((t) => t.kind === "pack" && t.refImages.length > 0).map((t) => shape(t, false));
    const own = session?.user?.id ? (await listOwnPacks(session.user.id)).map((t) => shape(t, true)) : [];
    return NextResponse.json({ packs: [...own, ...ready] });
  } catch (e) {
    console.error("[AD PACKS] list failed:", e);
    return NextResponse.json({ packs: [] });
  }
}

async function handlePOST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const b = await request.json().catch(() => ({}));
  const refs: string[] = Array.isArray(b.refs) ? b.refs.filter((x: unknown): x is string => typeof x === "string" && x.length > 8).slice(0, 8) : [];
  if (!refs.length) return NextResponse.json({ error: "Add at least one reference ad." }, { status: 400 });
  if ((await db.designTemplate.count({ where: { ownerId: userId } })) >= 10) {
    return NextResponse.json({ error: "You have 10 packs already. Delete one first." }, { status: 400 });
  }

  let auth;
  try {
    auth = await authorize(userId, [{ key: "chat.text", qty: 3 }], { trial: "none" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: "Not enough credits to study your references", code: "insufficient_credits", neededMilli: e.neededMilli }, { status: 402 });
    throw e;
  }

  try {
    const { packDna, refDnas } = await studyPack(refs);
    const last = await db.designTemplate.findFirst({ orderBy: { number: "desc" } });
    const row = await db.designTemplate.create({
      data: {
        number: (last?.number ?? 0) + 1,
        title: (typeof b.name === "string" && b.name.trim() ? b.name.trim() : "My ad pack").slice(0, 80),
        description: "",
        kind: "pack",
        aspect: "4:5",
        prompt: "",
        params: [],
        styles: [],
        refImages: refs,
        coverImages: refs.slice(0, 4),
        packDna,
        refDnas,
        needsProduct: false,
        useBrandBrain: true,
        published: false,
        ownerId: userId,
      },
    });
    await commit(userId, auth, [{ key: "chat.text", qty: 3 }], { ref: `adpack:${row.id}`, note: "Ad pack: studied references" }).catch((e) => console.error("[AD PACKS] billing failed:", e));
    return NextResponse.json({ success: true, pack: { id: row.id, title: row.title, description: "", mine: true, coverImages: refs.slice(0, 4) } });
  } catch (e) {
    console.error("[AD PACKS] create failed:", e);
    return NextResponse.json({ error: "Could not study the references. Nothing was charged. Try again." }, { status: 500 });
  }
}
export const POST = withUsage(handlePOST);

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  await db.designTemplate.deleteMany({ where: { id, ownerId: session.user.id } });
  return NextResponse.json({ success: true });
}
