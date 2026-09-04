// ============================================================
// UXLLY — Image Generation API Route
// Supports Together AI (free FLUX) and OpenAI (GPT Image 2)
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { openaiGenerateImage } from "@/lib/ai/providers/openai";
import { togetherGenerateImage } from "@/lib/ai/providers/together";
import type { ImageSize } from "@/types";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log("[IMAGE] ❌ Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, size, style, quality, brandId } = await request.json();
    console.log("[IMAGE] 📝 Prompt:", prompt?.slice(0, 80) + "...");
    console.log("[IMAGE] 📐 Size:", size);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Brand lookup — loads both the logo (for compositing) AND the style
    // guide colors, so brand colors apply here too, not just in chat.
    let logoUrl: string | null = null;
    let logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | undefined = undefined;
    let logoScale: number | undefined = undefined;
    let brandStyleGuide: Record<string, unknown> | null = null;

    if (brandId) {
      const brand = await db.brand.findFirst({
        where: { id: brandId, userId: session.user.id },
        include: { styleGuide: true },
      });
      if (brand?.logo) {
        logoUrl = brand.logo;
        logoPosition = (brand.logoPosition as typeof logoPosition) || undefined;
        logoScale = brand.logoScale ?? undefined;
      }
      if (brand?.styleGuide) {
        brandStyleGuide = {
          primaryColor: brand.styleGuide.primaryColor,
          secondaryColor: brand.styleGuide.secondaryColor,
          accentColor: brand.styleGuide.accentColor,
          backgroundColor: brand.styleGuide.backgroundColor ?? undefined,
          headingFont: brand.styleGuide.headingFont,
          tone: brand.styleGuide.tone,
        };
      }
    }

    const imageSize = (size || "1080x1080") as ImageSize;
    const provider = process.env.IMAGE_PROVIDER || "together";
    console.log("[IMAGE] 🔧 Provider:", provider);
    console.log("[IMAGE] 🔑 OpenAI key:", process.env.OPENAI_API_KEY ? "SET" : "MISSING");
    console.log("[IMAGE] 🔑 Together key:", process.env.TOGETHER_API_KEY ? "SET" : "MISSING");

    let response;

    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      console.log("[IMAGE] 🚀 Using OpenAI...");
      response = await openaiGenerateImage({
        prompt,
        size: imageSize,
        quality: "medium",
        styleGuide: brandStyleGuide,
        logoUrl,
        logoPosition,
        logoScale,
      });
    } else if (process.env.TOGETHER_API_KEY) {
      console.log("[IMAGE] 🚀 Using Together AI (FLUX)...");
      response = await togetherGenerateImage({
        prompt,
        size: imageSize,
      });
    } else if (process.env.OPENAI_API_KEY) {
      console.log("[IMAGE] 🚀 Using OpenAI (fallback)...");
      response = await openaiGenerateImage({
        prompt,
        size: imageSize,
        quality: "medium",
        styleGuide: brandStyleGuide,
        logoUrl,
        logoPosition,
        logoScale,
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

    return NextResponse.json({
      imageUrl: response.url,
      revisedPrompt: response.revisedPrompt,
    });
  } catch (error) {
    console.error("[IMAGE] ❌ Error:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}