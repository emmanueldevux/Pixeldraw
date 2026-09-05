// ============================================================
// UXLLY — Reference Image Analysis API
// Uses GPT-4o Vision to analyze reference images and extract
// a detailed style guide (colors, fonts, layout, mood, etc.)
// Saves the analysis to the StyleGuide.rawMarkdown field
// ============================================================

import { NextResponse } from "next/server";

export const maxDuration = 120;

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { detectAndSliceGrid } from "@/lib/ai/gridDetect";
import type { LayoutArchetype } from "@/types";

const ANALYSIS_PROMPT = `You are an expert visual designer and brand strategist. Analyze these reference images and extract a comprehensive style guide.

For each image, identify:
1. **Color Palette** — List exact hex codes for primary, secondary, accent, background colors
2. **Typography** — Font style (sans-serif/serif/mono/display), weight (light/regular/bold/black), case (uppercase/lowercase/title), sizing patterns
3. **Layout & Composition** — Grid structure, alignment, spacing, visual hierarchy, use of whitespace
4. **Visual Style** — Flat design / 3D / photorealistic / illustrated / gradient / glassmorphism
5. **Mood & Tone** — Professional / playful / bold / minimal / luxurious / techy / organic
6. **Recurring Patterns** — Any consistent design elements across the references (shapes, borders, shadows, overlays)
7. **Text Treatment** — How text is styled on images (overlays, contained in boxes, floating, text-on-dark, text-on-light)
8. **Background Treatment** — Solid colors, gradients, images, patterns, dark vs light
9. **Distinctive Elements** — What makes this style unique and recognizable

Then write a unified **Style Guide Summary** that combines all observations into clear rules an AI image generator should follow to match this style.

Format your response as a clean markdown document with sections. Be specific — include actual hex colors, exact descriptions, and concrete rules. This will be used to instruct an AI to generate new images matching this exact style.`;

const LAYOUT_ARCHETYPE_PROMPT = `These images are individual panels from one brand's design system — all sharing the same visual style (colors, typography, mood) but each using a different LAYOUT.

Identify each DISTINCT layout pattern you see. Only group two panels together if their arrangement is genuinely near-identical (same element positions, same structure) — err on the side of keeping panels SEPARATE rather than collapsing them into one generic archetype. A brand's real design system usually has 3-6+ distinct layouts; if you're only finding 1-2, look again more carefully at where text, images, and objects sit differently across panels (top-left vs centered vs bottom-anchored, single-column vs split, etc).

For each distinct pattern, describe:
- "name": a short snake_case slug, e.g. "big_stat_number", "headline_subtext", "icon_composition", "ui_mockup_showcase", "minimal_wordmark", "countdown_timer"
- "composition": Describe EXACTLY where text, images, logos/icons, and other elements are placed and how they relate to each other. State text alignment precisely — horizontal (left-aligned / center-aligned / right-aligned) AND vertical (top / middle / bottom) zone. State where the main image/graphic sits relative to the text (same side, opposite side, behind, below), and the reading flow (text-first, image-first, overlapping). Note any secondary elements (badges, logos, buttons) and where they anchor. Specific enough for an image generator to recreate the ARRANGEMENT — "top-middle aligned" or "left-aligned, vertically centered" are the kind of precise answers needed, not "balanced" or "clear hierarchy". Do not repeat brand colors or fonts here, only layout/placement.

Return ONLY valid JSON, no markdown, no backticks:
{
  "layout_archetypes": [
    { "name": "big_stat_number", "composition": "..." }
  ]
}`;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { brandId, referenceImages } = await request.json();

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    if (!referenceImages || referenceImages.length === 0) {
      return NextResponse.json({ error: "No reference images provided" }, { status: 400 });
    }

    // Verify brand belongs to user
    const brand = await db.brand.findFirst({
      where: { id: brandId, userId: session.user.id },
      include: { styleGuide: true },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Check for OpenAI key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key required for image analysis" },
        { status: 500 }
      );
    }

    console.log("[ANALYZE] 🔍 Analyzing", referenceImages.length, "reference images for brand:", brand.name);

    const client = new OpenAI({ apiKey });

    // Slice any grid/moodboard references into individual cells first —
    // sending a whole 4x4 grid to the vision model as "one image" confuses
    // it (it tries to describe/replicate the grid itself). Each cell gets
    // analyzed as its own layout example instead.
    const allCells: string[] = []; // every image the style-markdown call will see
    const archetypeCells: string[] = []; // only cells that came from a detected grid

    for (const img of referenceImages as string[]) {
      let url = img;
      if (url.startsWith("data:") && !url.match(/^data:image\/(png|jpeg|gif|webp)/)) {
        url = url.replace(/^data:[^;]+;/, "data:image/jpeg;");
      }
      if (!url.startsWith("data:image/")) {
        console.log("[ANALYZE] Skipping invalid image format:", url.slice(0, 40));
        continue;
      }

      const sliceResult = await detectAndSliceGrid(url);
      if (sliceResult.isGrid) {
        console.log(`[ANALYZE] 🔲 Grid reference detected: ${sliceResult.rows}x${sliceResult.cols}`);
        allCells.push(...sliceResult.cells);
        archetypeCells.push(...sliceResult.cells);
      } else {
        allCells.push(url);
      }
    }

    // Build vision message with all (possibly sliced) reference images
    const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = allCells.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    }));

    if (imageContent.length === 0) {
      return NextResponse.json({ error: "No valid images to analyze" }, { status: 400 });
    }

    console.log("[ANALYZE] Sending", imageContent.length, "valid images to GPT-4o");

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            ...imageContent,
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.3,
    });

    const analysis = response.choices[0]?.message?.content || "";
    console.log("[ANALYZE] ✅ Analysis complete, length:", analysis.length);

    // ==================== Layout Archetype Extraction ====================
    // Only runs if at least one grid/moodboard reference was detected —
    // this is what teaches the AI "this brand has N distinct layouts"
    // instead of locking every generation to one composition.
    let layoutArchetypes: LayoutArchetype[] | null = null;

    if (archetypeCells.length > 0) {
      try {
        // Cap total cells sent for cost/token control
        const cellsForArchetypes = archetypeCells.slice(0, 24);
        console.log("[ANALYZE] 🧩 Extracting layout archetypes from", cellsForArchetypes.length, "grid cells");

        const archetypeContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = cellsForArchetypes.map(
          (url) => ({
            type: "image_url" as const,
            image_url: { url, detail: "low" as const },
          })
        );

        const archetypeResponse = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: LAYOUT_ARCHETYPE_PROMPT }, ...archetypeContent],
            },
          ],
          max_tokens: 1500,
          temperature: 0.2,
        });

        const rawJSON = archetypeResponse.choices[0]?.message?.content?.trim() || "{}";
        const cleaned = rawJSON.replace(/```json\n?|```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned) as { layout_archetypes?: LayoutArchetype[] };

        if (Array.isArray(parsed.layout_archetypes) && parsed.layout_archetypes.length > 0) {
          layoutArchetypes = parsed.layout_archetypes.filter((a) => a?.name && a?.composition);
          console.log(
            "[ANALYZE] 🧩 Extracted",
            layoutArchetypes.length,
            "layout archetypes:",
            layoutArchetypes.map((a) => a.name).join(", ")
          );
        }
      } catch (err) {
        console.error("[ANALYZE] Layout archetype extraction failed (non-fatal):", err);
      }
    }

    // Extract colors from the analysis (simple regex for hex codes) — but
    // NEVER let this silently overwrite colors the user already set. This
    // was the actual root cause of colors "not being on brand": every
    // analyze run was clobbering the user's explicit primary/secondary/
    // accent with whatever hex codes happened to appear in the reference
    // analysis text, regardless of what was saved at brand creation.
    //
    // Rule: if a StyleGuide row already exists at all, its colors were put
    // there deliberately by brand creation (user-chosen or that flow's own
    // defaults) — analysis must never override them, no matter what colors
    // it finds in the reference. Extracted hex codes only ever seed colors
    // for the rare case where no StyleGuide exists yet at analyze time.
    const hexColors = analysis.match(/#[0-9A-Fa-f]{6}/g) || [];
    const hasExistingStyleGuide = !!brand.styleGuide;

    const primaryColor = hasExistingStyleGuide
      ? brand.styleGuide!.primaryColor
      : hexColors[0] || "#2563EB";
    const secondaryColor = hasExistingStyleGuide
      ? brand.styleGuide!.secondaryColor
      : hexColors[1] || "#1D4ED8";
    const accentColor = hasExistingStyleGuide
      ? brand.styleGuide!.accentColor
      : hexColors[2] || "#22C55E";

    console.log(
      "[ANALYZE] 🎨 Color decision — hasExistingStyleGuide:", hasExistingStyleGuide,
      "| hex found in analysis (NOT applied if styleGuide exists):", hexColors.slice(0, 3),
      "| FINAL primary/secondary/accent (preserved from brand):", primaryColor, secondaryColor, accentColor
    );

    // Detect tone from analysis — same rule as colors: never override a
    // tone the user already explicitly chose at brand creation.
    let detectedTone = "professional";
    const analysisLower = analysis.toLowerCase();
    if (analysisLower.includes("bold") || analysisLower.includes("striking")) detectedTone = "bold";
    else if (analysisLower.includes("minimal") || analysisLower.includes("clean")) detectedTone = "minimal";
    else if (analysisLower.includes("playful") || analysisLower.includes("fun")) detectedTone = "playful";
    else if (analysisLower.includes("casual") || analysisLower.includes("friendly")) detectedTone = "casual";
    const finalTone = hasExistingStyleGuide ? brand.styleGuide!.tone : detectedTone;

    // Detect font style — same rule: preserve whatever's already set.
    let detectedFont = "Inter";
    if (analysisLower.includes("serif") && !analysisLower.includes("sans-serif")) detectedFont = "Playfair Display";
    else if (analysisLower.includes("mono")) detectedFont = "JetBrains Mono";
    else if (analysisLower.includes("display") || analysisLower.includes("bold sans")) detectedFont = "Montserrat";
    else if (analysisLower.includes("geometric")) detectedFont = "Poppins";
    const finalFont = hasExistingStyleGuide ? brand.styleGuide!.headingFont : detectedFont;

    // Build the generation pool — the set of images generation actually
    // picks from at random. Grid references contribute their individual
    // sliced panels (not the raw grid, which makes a poor edit-base since
    // it's a composite of many designs, not one). Plain uploads pass
    // through unchanged. Merges with any existing pool from a prior
    // analysis so re-analyzing (e.g. adding another reference later) grows
    // the pool instead of replacing it. Capped to keep payload size sane.
    const existingPool = ((brand.styleGuide as any)?.generationPool as string[] | null) || [];
    const newPool = Array.from(new Set([...existingPool, ...allCells])).slice(0, 30);
    console.log("[ANALYZE] 🎲 Generation pool:", newPool.length, "images (", allCells.length, "new from this analysis )");

    // Merge newly extracted archetypes with any already saved — re-analyzing
    // (e.g. adding another grid reference later) should grow the library,
    // not replace it. Same name = update its composition, else append.
    let mergedArchetypes: LayoutArchetype[] | undefined;
    if (layoutArchetypes) {
      const existing = (brand.styleGuide?.layoutArchetypes as unknown as LayoutArchetype[] | null) || [];
      const byName = new Map(existing.map((a) => [a.name, a]));
      for (const a of layoutArchetypes) byName.set(a.name, a);
      mergedArchetypes = Array.from(byName.values());
    }

    // Save analysis to StyleGuide
    if (brand.styleGuide) {
      await db.styleGuide.update({
        where: { id: brand.styleGuide.id },
        data: {
          rawMarkdown: analysis,
          primaryColor,
          secondaryColor,
          accentColor,
          headingFont: finalFont,
          tone: finalTone,
          generationPool: newPool,
          ...(mergedArchetypes ? { layoutArchetypes: mergedArchetypes as unknown as Prisma.InputJsonValue } : {}),
        },
      });
    } else {
      await db.styleGuide.create({
        data: {
          brandId,
          rawMarkdown: analysis,
          primaryColor,
          secondaryColor,
          accentColor,
          headingFont: finalFont,
          tone: finalTone,
          referenceImages: referenceImages,
          generationPool: newPool,
          ...(mergedArchetypes ? { layoutArchetypes: mergedArchetypes as unknown as Prisma.InputJsonValue } : {}),
        },
      });
    }

    console.log(
      "[ANALYZE] 💾 Saved analysis | Colors:", primaryColor, secondaryColor, accentColor,
      "| Tone:", finalTone, "| Font:", finalFont,
      "| (preserved existing brand values:", hasExistingStyleGuide, ")",
      "| Layout archetypes:", mergedArchetypes?.length ?? 0
    );

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        extractedColors: { primaryColor, secondaryColor, accentColor },
        detectedTone: finalTone,
        detectedFont: finalFont,
      },
    });
  } catch (error) {
    console.error("[ANALYZE] ❌ Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze references" },
      { status: 500 }
    );
  }
}