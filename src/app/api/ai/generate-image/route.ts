// ============================================================
// UXLLY — Image Generation API Route
// Supports Together AI (free FLUX) and OpenAI (GPT Image 2)
// ============================================================

import { withUsage, applyProjectNegative } from "@/lib/billing/usage";
import { saveGeneration } from "@/lib/generations";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const maxDuration = 300;
import { db } from "@/lib/db";
import { openaiGenerateImage } from "@/lib/ai/providers/openai";
import { togetherGenerateImage } from "@/lib/ai/providers/together";
import type { ImageSize } from "@/types";
import type { LogoPosition } from "@/lib/ai/logoComposite";
import { randomUUID } from "crypto";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { insufficientResponse } from "@/lib/billing/http";
import { imageKey } from "@/lib/billing/pricing";

async function handlePOST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log("[IMAGE] ❌ Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, size, style, quality, brandId, productImage, imageProvider } = await request.json();
    console.log("[IMAGE] 📝 Prompt:", prompt?.slice(0, 80) + "...");
    console.log("[IMAGE] 📐 Size:", size);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // ---- BILLING: check first, charge after success.
    const billingKey = imageKey({ imageProvider, productImage });
    const billingRef = randomUUID();
    let auth;
    try {
      auth = await authorize(session.user.id, [{ key: billingKey }], { trial: "consume" });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) return insufficientResponse(e);
      throw e;
    }

    // Brand lookup — loads both the logo (for compositing) AND the style
    // guide colors, so brand colors apply here too, not just in chat.
    let logoUrl: string | null = null;
    let logoPosition: LogoPosition | undefined = undefined;
    let logoScale: number | undefined = undefined;
    let brandStyleGuide: Record<string, unknown> | null = null;

    if (brandId) {
      const brand = await db.brand.findFirst({
        where: { id: brandId, userId: session.user.id },
        include: { styleGuide: true },
      });
      if (brand?.logo) {
        logoUrl = brand.logo;
        logoPosition = (brand.logoPosition as unknown as LogoPosition) || undefined;
        logoScale = brand.logoScale ?? undefined;
      }
      if (brand?.styleGuide) {
        const adv = ((brand.styleGuide as unknown as { advancedSettings?: Record<string, unknown> }).advancedSettings) || {};
        applyProjectNegative(adv);
        brandStyleGuide = {
          primaryColor: brand.styleGuide.primaryColor,
          secondaryColor: brand.styleGuide.secondaryColor,
          accentColor: brand.styleGuide.accentColor,
          backgroundColor: brand.styleGuide.backgroundColor ?? undefined,
          headingFont: brand.styleGuide.headingFont,
          tone: brand.styleGuide.tone,
          language: (adv.language as string) || undefined,
          ecommerce: adv.ecommerce,
        };
      }
    }

    const imageSize = (size || "1080x1080") as ImageSize;
    // Per-request model pick overrides the server default; an attached product
    // image forces OpenAI (FLUX can't take an input image).
    const provider = imageProvider || process.env.IMAGE_PROVIDER || "together";
    const preferOpenAI = provider === "openai" || !!productImage;
    console.log("[IMAGE] 🔧 Provider:", provider);
    console.log("[IMAGE] 🔑 OpenAI key:", process.env.OPENAI_API_KEY ? "SET" : "MISSING");
    console.log("[IMAGE] 🔑 Together key:", process.env.TOGETHER_API_KEY ? "SET" : "MISSING");

    let response;

    if (preferOpenAI && process.env.OPENAI_API_KEY) {
      console.log("[IMAGE] 🚀 Using OpenAI...", productImage ? "(with product image)" : "");
      response = await openaiGenerateImage({
        prompt,
        size: imageSize,
        quality: (process.env.OPENAI_IMAGE_QUALITY_EDIT || "low") as "low" | "medium" | "high" | "auto",
        styleGuide: brandStyleGuide,
        logoUrl: null, // logo is overlaid on the client as a draggable layer, not baked in
        productImage: productImage || null,
      });
    } else if (process.env.TOGETHER_API_KEY && !productImage) {
      console.log("[IMAGE] 🚀 Using Together AI (FLUX)...");
      response = await togetherGenerateImage({
        prompt,
        size: imageSize,
      });
    } else if (process.env.OPENAI_API_KEY) {
      console.log("[IMAGE] 🚀 Using OpenAI (fallback)...", productImage ? "(with product image)" : "");
      response = await openaiGenerateImage({
        prompt,
        size: imageSize,
        quality: (process.env.OPENAI_IMAGE_QUALITY_EDIT || "low") as "low" | "medium" | "high" | "auto",
        styleGuide: brandStyleGuide,
        logoUrl: null, // logo is overlaid on the client as a draggable layer, not baked in
        productImage: productImage || null,
      });
    } else {
      console.log("[IMAGE] ❌ No provider configured");
      return NextResponse.json(
        { error: "No image provider configured" },
        { status: 500 }
      );
    }

    console.log("[IMAGE] ✅ Generated! URL:", response.url?.slice(0, 80) + "...");
    console.log("[IMAGE] ✅ Full URL length:", response.url?.length);

    try {
      await commit(session.user.id, auth, [{ key: billingKey }], { ref: billingRef, producedImage: true });
    } catch (billErr) {
      console.error("[IMAGE] ⚠️ billing commit failed (image still returned):", billErr);
    }

    // Save the design (storage + Files tab).
    const saved = await saveGeneration({
      userId: session.user.id,
      brandId: brandId || null,
      kind: "image",
      title: String(prompt || "").slice(0, 120),
      imageUrls: [response.url],
      prompt: String(prompt || ""),
      meta: { source: "generate-image", size: imageSize },
    });

    return NextResponse.json({
      generationId: saved.id,
      imageUrl: saved.imageUrls[0],
      revisedPrompt: response.revisedPrompt,
      logo: logoUrl ? { url: logoUrl, position: logoPosition || "bottom-right", scale: logoScale || 0.14 } : null,
    });
  } catch (error) {
    console.error("[IMAGE] ❌ Error:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}

// Every AI call in this request is measured for real-cost billing.
export const POST = withUsage(handlePOST);
