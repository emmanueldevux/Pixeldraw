// ============================================================
// UXLLY — Public list of published design templates (templates page)
// The prompt text is never sent to the browser.
// ============================================================
import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/designTemplates/store";
import { ASPECT_TO_SIZE, toPublic } from "@/lib/designTemplates/types";
import { getSettings } from "@/lib/billing/settings";
import { chargeMilliForCost, imageOutTokens } from "@/lib/billing/metered";
import { templateQuality, templateSize } from "@/lib/ai/providers/openai";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [list, settings] = await Promise.all([listTemplates({ publishedOnly: true }), getSettings()]);
    // "Typical" charge shown to users (the real charge is measured per run).
    const typical = (needsProduct: boolean, aspect: keyof typeof ASPECT_TO_SIZE) => {
      const out = imageOutTokens(templateSize(ASPECT_TO_SIZE[aspect]), templateQuality());
      const micro = (1200 * settings.imageTextInCentsPerM + (needsProduct ? 1500 : 0) * settings.imageImageInCentsPerM + out * settings.imageOutCentsPerM) / 100;
      return chargeMilliForCost(micro, settings);
    };
    return NextResponse.json({ templates: list.map((t) => ({ ...toPublic(t), typicalMilli: typical(t.needsProduct, t.aspect) })) });
  } catch (e) {
    console.error("[TEMPLATES] list failed:", e);
    return NextResponse.json({ templates: [], error: "Templates are not set up yet" }, { status: 500 });
  }
}
