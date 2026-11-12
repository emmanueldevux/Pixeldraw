// ============================================================
// UXLLY — Admin: design templates
//   GET                                   → all templates (incl. drafts, with prompt)
//   POST { action: "save", id?, template } → create (no id) or update
//   POST { action: "delete", id }
//   POST { action: "uploadCover", dataUrl } → { url }
//   POST { action: "preview", id?, template, values, styleKey } → final prompt text
//   POST { action: "studyPack", refs }       → { packDna, refDnas } (reference packs)
// ============================================================
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/billing/http";
import { deleteTemplate, listTemplates, saveTemplate, storeCover } from "@/lib/designTemplates/store";
import { cleanTemplateInput, renderPrompt } from "@/lib/designTemplates/types";
import { studyPack } from "@/lib/designTemplates/pack";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const forbidden = () => NextResponse.json({ error: "Admins only" }, { status: 403 });

export async function GET() {
  if (!(await requireAdmin())) return forbidden();
  return NextResponse.json({ templates: await listTemplates({ publishedOnly: false }) });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return forbidden();
  const body = await request.json().catch(() => ({}));
  try {
    switch (body?.action) {
      case "save":
        return NextResponse.json({ template: await saveTemplate(typeof body.id === "string" ? body.id : null, body.template || {}) });
      case "delete":
        await deleteTemplate(String(body.id));
        return NextResponse.json({ ok: true });
      case "uploadCover":
        return NextResponse.json({ url: await storeCover(String(body.dataUrl || "")) });
      case "studyPack": {
        const refs = Array.isArray(body.refs) ? body.refs.filter((r: unknown) => typeof r === "string") : [];
        return NextResponse.json(await studyPack(refs));
      }
      case "preview": {
        const t = cleanTemplateInput(body.template || {});
        return NextResponse.json({ prompt: renderPrompt(t, body.values || {}, body.styleKey || null, "") });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[ADMIN TEMPLATES]", e);
    return NextResponse.json({ error: (e as Error).message || "Failed" }, { status: 500 });
  }
}
