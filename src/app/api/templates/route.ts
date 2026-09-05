// ============================================================
// UXLLY — Templates List API
// Exposes the dynamically-scanned /public/templates/ contents to the
// client-side picker modal, since browser code can't read the server
// filesystem directly.
// ============================================================

import { NextResponse } from "next/server";
import { listAvailableTemplates } from "@/lib/templates";

export async function GET() {
  const templates = await listAvailableTemplates();
  return NextResponse.json({ success: true, templates });
}