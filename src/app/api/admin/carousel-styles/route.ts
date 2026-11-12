// ============================================================
// UXLLY — Admin: carousel styles
//   GET                                          → all styles
//   POST { action: "save", id?, style }          → create / update
//   POST { action: "delete", id }
//   POST { action: "upload", dataUrl }           → { url }
//   POST { action: "study", slot, refs }         → { dna }  (AI studies the slot's references)
// ============================================================
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/billing/http";
import { deleteStyle, listStyles, saveStyle } from "@/lib/carousels/store";
import { storeCover } from "@/lib/designTemplates/store";
import { studySlot } from "@/lib/carousels/dna";
import { SLOTS, type SlotKey } from "@/lib/carousels/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const forbidden = () => NextResponse.json({ error: "Admins only" }, { status: 403 });

export async function GET() {
  if (!(await requireAdmin())) return forbidden();
  return NextResponse.json({ styles: await listStyles({ publishedOnly: false }) });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return forbidden();
  const body = await request.json().catch(() => ({}));
  try {
    switch (body?.action) {
      case "save":
        return NextResponse.json({ style: await saveStyle(typeof body.id === "string" ? body.id : null, body.style || {}) });
      case "delete":
        await deleteStyle(String(body.id));
        return NextResponse.json({ ok: true });
      case "upload":
        return NextResponse.json({ url: await storeCover(String(body.dataUrl || "")) });
      case "study": {
        if (!SLOTS.includes(body.slot)) return NextResponse.json({ error: "Unknown slot" }, { status: 400 });
        const refs = Array.isArray(body.refs) ? body.refs.filter((r: unknown) => typeof r === "string") : [];
        return NextResponse.json({ dna: await studySlot(body.slot as SlotKey, refs) });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[ADMIN CAROUSEL STYLES]", e);
    return NextResponse.json({ error: (e as Error).message || "Failed" }, { status: 500 });
  }
}
