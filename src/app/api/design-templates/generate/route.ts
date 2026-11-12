// ============================================================
// UXLLY — Generate a design from a template
// POST { templateId, productImage?, values?, styleKey?, brandId? }
// Billing: real cost × markup. authorize() checks a cautious estimate and
// starts measuring; commit() charges the measured OpenAI usage.
// ============================================================
import { withUsage, applyProjectNegative } from "@/lib/billing/usage";
import { generatePackAd } from "@/lib/designTemplates/pack";
import { adCraftNote } from "@/lib/ai/adCraft";
import { saveGeneration } from "@/lib/generations";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { insufficientResponse } from "@/lib/billing/http";
import { getTemplate, bumpUsage } from "@/lib/designTemplates/store";
import { ASPECT_TO_SIZE, brandColoursText, renderPrompt } from "@/lib/designTemplates/types";
import { openaiTemplateImage } from "@/lib/ai/providers/openai";
import { trimToAspect } from "@/lib/designTemplates/crop";
import { ensureBrain } from "@/lib/brain/generate";
import { brainImageNote } from "@/lib/brain/prompt";
import { isEmptyBrain } from "@/lib/brain/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handlePOST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json().catch(() => ({}));
  const template = typeof body?.templateId === "string" ? await getTemplate(body.templateId) : null;
  if (!template || !template.published) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const productImage = typeof body?.productImage === "string" && body.productImage.startsWith("data:image") ? body.productImage : null;
  if (template.needsProduct && !productImage) return NextResponse.json({ error: "Upload a photo of your product first" }, { status: 400 });
  if (productImage && productImage.length > 14_000_000) return NextResponse.json({ error: "That photo is too large. Use one under 10 MB." }, { status: 400 });

  const values: Record<string, string> = {};
  if (body?.values && typeof body.values === "object") {
    for (const [k, v] of Object.entries(body.values as Record<string, unknown>)) if (typeof v === "string") values[k] = v;
  }
  const styleKey = typeof body?.styleKey === "string" && template.styles.some((s) => s.key === body.styleKey) ? body.styleKey : null;

  // The picked project: brand colours always; brand voice when the template allows it.
  let brandNote = "";
  let brainForCraft: import("@/lib/brain/types").BrainData | null = null;
  let brandColours: string | null = null;
  let brandFont: string | null = null;
  if (typeof body?.brandId === "string" && body.brandId) {
    const owned = await db.brand.findFirst({ where: { id: body.brandId, userId }, include: { styleGuide: true } });
    if (owned) {
      const sg = owned.styleGuide;
      applyProjectNegative((sg as unknown as { advancedSettings?: unknown } | null)?.advancedSettings);
      if (sg?.headingFont) brandFont = sg.headingFont;
      if (sg) brandColours = brandColoursText({ primary: sg.primaryColor, secondary: sg.secondaryColor, accent: sg.accentColor, background: sg.backgroundColor });
      if (template.useBrandBrain) {
        // Builds the brain on first use if the background build never ran.
        const brain = await ensureBrain(body.brandId).catch(() => null);
        if (brain && !isEmptyBrain(brain.data)) { brandNote = brainImageNote(brain.data); brainForCraft = brain.data; }
      }
    }
  }

  const isPack = template.kind === "pack";
  if (isPack && !template.refImages.length) return NextResponse.json({ error: "This template has no reference ads yet" }, { status: 400 });
  if (isPack && !(values.Brief || "").trim()) return NextResponse.json({ error: "Tell us what the ad is for" }, { status: 400 });
  const prompt = isPack ? "" : renderPrompt(template, values, styleKey, brandNote, brandColours);
  const size = ASPECT_TO_SIZE[template.aspect];
  const billingKey = productImage ? "image.edit" : "image.openai";
  const ref = randomUUID();
  let auth;
  try {
    auth = await authorize(userId, [{ key: billingKey }], { trial: "consume" });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return insufficientResponse(e);
    throw e;
  }

  try {
    // Reference packs: the AI picks the best reference ad and rebuilds its layout for this brand.
    const res = isPack
      ? await generatePackAd({
          pack: template,
          brief: values.Brief.slice(0, 1500),
          headline: (values.Headline || "").trim().slice(0, 120) || undefined,
          size,
          aspect: template.aspect,
          colours: brandColours,
          font: brandFont,
          brandNote: [brandNote, adCraftNote(values.Brief || "", brainForCraft)].filter(Boolean).join("\n\n"),
          productImage,
        }).then((r) => ({ url: r.url }))
      : await openaiTemplateImage({ prompt, size, productImage });
    let chargedMilli = 0;
    try {
      const c = await commit(userId, auth, [{ key: billingKey }], {
        ref,
        producedImage: true,
        note: `Template ${template.number}: ${template.title}`,
      });
      chargedMilli = c.chargedMilli;
    } catch (billErr) {
      console.error("[TEMPLATES] billing commit failed (image still returned):", billErr);
    }
    bumpUsage(template.id);
    // OpenAI renders 2:3 portrait; trim to the template's exact format (e.g. 4:5).
    // (9:16 stays at OpenAI's 2:3 portrait: trimming the sides could cut text.)
    const imageUrl = template.aspect !== "4:5" || isPack ? res.url : await trimToAspect(res.url, template.aspect).catch((e) => {
      console.warn("[TEMPLATES] trim failed, returning untrimmed:", e);
      return res.url;
    });
    const saved = await saveGeneration({
      userId,
      brandId: typeof body?.brandId === "string" ? body.brandId : null,
      kind: "template",
      title: `Template ${template.number}: ${template.title}`,
      imageUrls: [imageUrl],
      meta: { templateId: template.id, kind: template.kind, values, styleKey },
    });
    return NextResponse.json({ imageUrl: saved.imageUrls[0], generationId: saved.id, aspect: template.aspect, chargedMilli, free: auth.free });
  } catch (e) {
    console.error("[TEMPLATES] generation failed:", e);
    return NextResponse.json({ error: "The design couldn't be generated. You were not charged. Try again." }, { status: 502 });
  }
}

// Every AI call in this request is measured for real-cost billing.
export const POST = withUsage(handlePOST);
