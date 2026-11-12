// ============================================================
// UXLLY — AI Chat API Route
// Connects to modular AI provider with skill-enhanced prompts
// Auto-generates images via Together AI (free) or OpenAI
// ============================================================

import { withUsage, applyProjectNegative } from "@/lib/billing/usage";
import { resolvePack } from "@/lib/designTemplates/store";
import { generatePackAd } from "@/lib/designTemplates/pack";
import { classifySubject, generateThumbnail, isThumbnailRequest, thumbSpec, thumbText } from "@/lib/designTemplates/thumb";
import { loadContext } from "@/lib/slideshow/context";
import { adCraftNote, moodFromVoice } from "@/lib/ai/adCraft";
import { brandColoursText } from "@/lib/designTemplates/types";
import { getBrain, generateBrain } from "@/lib/brain/generate";
import { brainImageNote, brainToPrompt } from "@/lib/brain/prompt";
import { trimToAspect } from "@/lib/designTemplates/crop";
import { saveGeneration } from "@/lib/generations";
import { isEmptyBrain } from "@/lib/brain/types";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// Vercel: generation regularly takes 100-130s. Requires Fluid Compute
// enabled on the project (Vercel dashboard → Settings → Functions) —
// without it, this value is capped much lower (10-60s) and every
// generation will time out with a 504 regardless of this setting.
export const maxDuration = 300;
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/skills";
import { extractImagePrompt } from "@/lib/utils";
import { openaiGenerateImage } from "@/lib/ai/providers/openai";
import { togetherGenerateImage } from "@/lib/ai/providers/together";
import type { AIMessage, ImageSize, StyleGuideData } from "@/types";
import type { LogoPosition } from "@/lib/ai/logoComposite";
import { getRandomTemplateAsBase64 } from "@/lib/templates";
import { randomUUID } from "crypto";
import { authorize, commit, InsufficientCreditsError } from "@/lib/billing/meter";
import { insufficientResponse } from "@/lib/billing/http";
import { imageKey } from "@/lib/billing/pricing";

// Pick the right image provider based on what's configured
async function generateImage(
  prompt: string,
  size: string,
  referenceImages?: string[],
  styleGuide?: Record<string, unknown> | null,
  platform?: string,
  brandName?: string | null,
  logoUrl?: string | null,
  logoPosition?: string | null,
  logoScale?: number | null,
  productImage?: string | null,
  imageProvider?: string | null
) {
  // A per-request model pick (from the composer's Models dropdown) overrides
  // the server default. A product image only works through OpenAI images.edit,
  // so when one is attached we prefer OpenAI regardless of the dropdown/FLUX.
  const provider = imageProvider || process.env.IMAGE_PROVIDER || "together";
  const preferOpenAI = provider === "openai" || !!productImage;
  const logoOpts = {
    logoUrl,
    logoPosition: (logoPosition as unknown as LogoPosition) || undefined,
    logoScale: logoScale ?? undefined,
  };

  // Logo is NOT composited here anymore — it's returned to the client and
  // overlaid as a draggable layer on the generated post.
  void logoOpts;

  if (preferOpenAI && process.env.OPENAI_API_KEY) {
    return openaiGenerateImage({ prompt, size: size as ImageSize, referenceImages, styleGuide, platform, brandName, productImage });
  }

  // FLUX can't take a product/reference image — only fall here when none attached.
  if (process.env.TOGETHER_API_KEY && !productImage) {
    return togetherGenerateImage({ prompt, size: size as ImageSize });
  }

  if (process.env.OPENAI_API_KEY) {
    return openaiGenerateImage({ prompt, size: size as ImageSize, referenceImages, styleGuide, platform, brandName, productImage });
  }

  throw new Error("No image provider configured.");
}

async function handlePOST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, platform, brandId, brandName, channelDescription, styleGuide, channelId, productImage, imageProvider, freeChat } =
      await request.json();

    console.log("[CHAT] 🔑 Received brandId:", brandId, "brandName:", brandName);

    // ---- BILLING: check first. Worst case = chat reply + one image. Nothing runs if they can't afford it.
    const billingRef = randomUUID();
    const likelyImageKey = imageKey({ imageProvider, productImage });
    let auth;
    try {
      auth = await authorize(session.user.id, [{ key: "chat.text" }, { key: likelyImageKey }], { trial: "consume" });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) return insufficientResponse(e);
      throw e;
    }

    // Load full style guide from DB
    let fullStyleGuide = styleGuide || null;
    let loadedBrand: {
      name: string;
      logo: string | null;
      logoPosition: string;
      logoScale: number;
      styleGuide: { referenceImages: unknown; generationPool: unknown } | null;
    } | null = null;

    const lookupId = brandId;
    if (lookupId) {
      try {
        const brand = await db.brand.findFirst({
          where: { id: lookupId, userId: session.user.id },
          include: { styleGuide: true },
        });

        loadedBrand = brand as any;

        if (brand?.styleGuide) {
          const refImages = brand.styleGuide.referenceImages;
          console.log("[CHAT] 📋 Style guide loaded for:", brand.name, `(brand id: ${brand.id})`);
          console.log("[CHAT] 📋 Analysis:", brand.styleGuide.rawMarkdown ? "YES" : "NO");
          console.log("[CHAT] 📋 referenceImages type:", typeof refImages);
          console.log("[CHAT] 📋 referenceImages isArray:", Array.isArray(refImages));
          console.log("[CHAT] 📋 referenceImages count:", Array.isArray(refImages) ? refImages.length : 0);
          console.log("[CHAT] 🎨 ===== COLORS LOADED FROM DB =====");
          console.log("[CHAT] 🎨 primaryColor:  ", brand.styleGuide.primaryColor);
          console.log("[CHAT] 🎨 secondaryColor:", brand.styleGuide.secondaryColor);
          console.log("[CHAT] 🎨 accentColor:   ", brand.styleGuide.accentColor);
          console.log("[CHAT] 🎨 backgroundColor:", brand.styleGuide.backgroundColor ?? "(not set — AI will decide)");
          console.log("[CHAT] 🎨 ===================================");

          const adv = ((brand.styleGuide as unknown as { advancedSettings?: Record<string, unknown> }).advancedSettings) || {};
          // The project's negative prompt applies to every image in this request.
          applyProjectNegative(adv);
          fullStyleGuide = {
            ...fullStyleGuide,
            primaryColor: brand.styleGuide.primaryColor,
            secondaryColor: brand.styleGuide.secondaryColor,
            accentColor: brand.styleGuide.accentColor,
            backgroundColor: brand.styleGuide.backgroundColor ?? undefined,
            headingFont: brand.styleGuide.headingFont,
            tone: brand.styleGuide.tone,
            extraNotes: brand.styleGuide.extraNotes,
            rawMarkdown: brand.styleGuide.rawMarkdown,
            layoutArchetypes: brand.styleGuide.layoutArchetypes as unknown as StyleGuideData["layoutArchetypes"],
            language: (adv.language as string) || undefined,
            ecommerce: adv.ecommerce as StyleGuideData["ecommerce"] | undefined,
          };
        } else {
          console.log("[CHAT] ⚠️ Brand found but no style guide");
        }
      } catch (err) {
        console.error("[CHAT] ❌ Failed to load brand:", err);
      }
    } else {
      console.log("[CHAT] ⚠️ No brandId provided");
    }

    // Build system prompt with skills
    const systemPrompt = buildSystemPrompt(
      ["copywriting", "imagePrompt", "inspirationInjection", "typography"],
      {
        brandName: brandName || "My Brand",
        platform: platform || "instagram_post",
        channelDescription: channelDescription || undefined,
        styleGuide: fullStyleGuide,
      }
    );

    // Free Chat (/chat) is brandless and image-first: no greetings, no
    // clarifying questions — always draft the image prompt right away.
    const freeChatRule = freeChat
      ? `\n\nFREE CHAT MODE: There is no brand and no project. The user wants an image NOW. Do NOT greet, do NOT ask questions, do NOT offer captions or menus. Reply with one short friendly sentence, then ONE \`\`\`prompt block that turns the user's request (and any attached reference/product image) into a detailed image-generation prompt. If the request is vague, make a confident creative choice. Always include the \`\`\`prompt block.`
      : "";

    // Thumbnail requests: a picture-only brief (no text in the image unless asked).
    const lastUserMsg = [...(messages as AIMessage[])].reverse().find((m) => m.role === "user");
    const askText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
    const thumbReq = isThumbnailRequest(askText, platform);
    const thumbSpecNow = thumbSpec(askText);
    const thumbTextNow = thumbText(askText);
    const thumbRule = thumbReq
      ? `\n\nTHUMBNAIL MODE: The user wants a thumbnail (${thumbSpecNow.aspect}). Reply with one short friendly sentence, then ONE \`\`\`prompt block that describes the SCENE only: the subject, their expression and pose, the setting, the mood and the colours. ${thumbTextNow.mode === "none" ? "Put NO text, words or letters in the image; the user did not ask for any." : "Include only the text the user asked for."} Do not ask questions; make confident choices.`
      : "";

    // The project's Brand Brain: audience, voice, positioning, real offers.
    // Every caption and headline the chat writes comes from this.
    let brainBlock = "";
    if (lookupId && !freeChat) {
      const brain = await getBrain(lookupId).catch(() => null);
      if (brain && !isEmptyBrain(brain.data)) brainBlock = `\n\n${brainToPrompt(brain.data)}`;
      else if (brain && brain.status !== "generating") generateBrain(lookupId).catch(() => {}); // ready for next time
    }

    // Prepend system message
    const fullMessages: AIMessage[] = [
      { role: "system", content: systemPrompt + brainBlock + freeChatRule + thumbRule },
      ...messages,
    ];

    // Call the active AI provider
    const response = await aiComplete({
      messages: fullMessages,
      temperature: 0.7,
      maxTokens: 2048,
    });

    // Check if response contains an auto-extractable image prompt
    let imageUrl: string | undefined;
    let packUsed: { id: string; refIndex: number } | null = null; // for the learning loop
    let imageLogo: { url: string; position: string; scale: number } | null = null;
    const imagePrompt = extractImagePrompt(response.content);
    console.log("[CHAT] 🔍 Extracted image prompt:", imagePrompt ? "YES (" + imagePrompt.slice(0, 60) + "...)" : "NONE");

    // Diagnostic: catch the text model reusing a previous turn's image
    // prompt verbatim instead of actually responding to the new message.
    // This makes the failure visible in logs immediately instead of only
    // showing up as "why is it the same image" several steps downstream.
    if (imagePrompt) {
      const priorAssistantMessages = (messages as AIMessage[])
        .filter((m) => m.role === "assistant")
        .map((m) => extractImagePrompt(m.content))
        .filter((p): p is string => !!p);
      const lastPriorPrompt = priorAssistantMessages[priorAssistantMessages.length - 1];
      if (lastPriorPrompt && lastPriorPrompt.trim() === imagePrompt.trim()) {
        console.warn(
          "[CHAT] ⚠️⚠️⚠️ DUPLICATE PROMPT DETECTED — the text model returned the exact same image prompt as the previous turn, despite a different user message. This means the drafting step failed to engage with the new request."
        );
      }
    }

    if (imagePrompt) {
      try {
        console.log("[CHAT] 🖼️ Auto-generating image...");
        // Prefer the generation pool — grid references get exploded into
        // their individual panels here, giving real variety to pick from.
        // Falls back to the raw reference board if no pool exists yet
        // (e.g. brand hasn't been analyzed, or references are all plain
        // single uploads with nothing to explode). Final fallback: a
        // built-in template, so a brand with zero references of its own
        // still gets a real structural anchor instead of pure text-only
        // generation.
        let refs: string[] = [];
        const rawPool = loadedBrand?.styleGuide?.generationPool;
        if (Array.isArray(rawPool) && rawPool.length > 0) {
          refs = rawPool as string[];
          console.log("[CHAT] 📸 Using generation pool:", refs.length, "images");
        } else if (loadedBrand?.styleGuide?.referenceImages) {
          const rawRefs = loadedBrand.styleGuide.referenceImages;
          if (Array.isArray(rawRefs) && rawRefs.length > 0) {
            refs = rawRefs as string[];
            console.log("[CHAT] 📸 No generation pool yet, using raw reference board:", refs.length, "images");
          }
        }
        // Thumbnails: the thumbnail brain (reference thumbnails, subject photo or character, size, no text unless asked).
        let packImage: string | null = null;
        if (thumbReq && process.env.OPENAI_API_KEY) {
          try {
            const adv = ((loadedBrand?.styleGuide as unknown as { advancedSettings?: { thumbPackId?: string } } | null)?.advancedSettings) || {};
            const brain = lookupId ? await getBrain(lookupId).catch(() => null) : null;
            const brainOk = !!brain && !isEmptyBrain(brain.data);
            const matchHint = brainOk ? [brain!.data.business.industry, brain!.data.voice.oneLine].filter(Boolean).join("; ") : "";
            const pack = await resolvePack(adv.thumbPackId, { userId: session.user.id, brief: askText, hint: matchHint, purpose: "thumbnail" }).catch(() => null);
            // Subject: an attached photo wins; otherwise the project's character sheet (by name if mentioned).
            const subjects: { url: string; kind: "person" | "product" }[] = [];
            let characterNote = "";
            if (productImage) {
              subjects.push({ url: productImage, kind: await classifySubject(productImage) });
            } else if (lookupId) {
              const ctx = await loadContext(session.user.id, lookupId).catch(() => null);
              const chars = ctx?.characters || [];
              const named = chars.find((c) => c.name && askText.toLowerCase().includes(c.name.toLowerCase()));
              const ch = named || chars[0];
              if (ch) {
                ch.photos.slice(0, 2).forEach((u) => subjects.push({ url: u, kind: "person" }));
                characterNote = [ch.name, ch.description].filter(Boolean).join(": ");
              }
            }
            const sgAny = loadedBrand?.styleGuide as unknown as Record<string, string | null> | null;
            const out = await generateThumbnail({
              pack,
              packId: pack?.id,
              brief: `${askText}\n\nScene notes from the assistant: ${imagePrompt}`.slice(0, 2500),
              spec: thumbSpecNow,
              text: thumbTextNow,
              subjects,
              characterNote,
              colours: sgAny ? brandColoursText({ primary: sgAny.primaryColor, secondary: sgAny.secondaryColor, accent: sgAny.accentColor, background: sgAny.backgroundColor }) : null,
              brandNote: brainOk ? brainImageNote(brain!.data) : "",
              matchHint,
            });
            packImage = out.url;
            if (pack && out.refIndex !== null) packUsed = { id: pack.id, refIndex: out.refIndex };
            console.log("[CHAT] 🖼️ Thumbnail", thumbSpecNow.aspect, pack ? `from pack ${pack.number} ref ${(out.refIndex ?? 0) + 1}` : "(no pack)", subjects.length ? `with ${subjects.length} subject photo(s)` : "");
          } catch (thumbErr) {
            console.error("[CHAT] thumbnail generation failed, falling back:", thumbErr);
          }
        }
        // No references of the project's own → the project's ad pack (admin reference packs).
        if (!thumbReq && refs.length === 0 && lookupId && process.env.OPENAI_API_KEY) {
          const adv = ((loadedBrand?.styleGuide as unknown as { advancedSettings?: { adPackId?: string } } | null)?.advancedSettings) || {};
          const brain = await getBrain(lookupId).catch(() => null);
          const lastUser = [...(messages as AIMessage[])].reverse().find((m) => m.role === "user");
          const userAsk = typeof lastUser?.content === "string" ? lastUser.content : "";
          const brainOk = !!brain && !isEmptyBrain(brain.data);
          const matchHint = brainOk ? [brain!.data.business.industry, brain!.data.voice.oneLine, moodFromVoice(brain!.data)].filter(Boolean).join("; ") : "";
          const pack = await resolvePack(adv.adPackId, { userId: session.user.id, brief: userAsk, hint: matchHint }).catch(() => null);
          if (pack) {
            const sgAny = loadedBrand?.styleGuide as unknown as Record<string, string | null> | null;
            const sizeFor: Record<string, string> = { instagram_portrait: "1080x1350", facebook_portrait: "1080x1350", linkedin_portrait: "1080x1350", instagram_story: "1080x1920", instagram_reel: "1080x1920", tiktok: "1080x1920", snapchat: "1080x1920", pinterest: "1000x1500", twitter: "1600x900", linkedin_post: "1200x627", facebook: "1200x630", youtube_thumbnail: "1280x720" };
            try {
              const out = await generatePackAd({
                pack,
                packId: pack.id,
                brief: `${typeof lastUser?.content === "string" ? lastUser.content : ""}\n\nDesign notes from the assistant: ${imagePrompt}`.slice(0, 2500),
                size: sizeFor[platform] || "1080x1080",
                aspect: (sizeFor[platform] === "1080x1350" ? "4:5" : undefined) as "4:5" | undefined,
                colours: sgAny ? brandColoursText({ primary: sgAny.primaryColor, secondary: sgAny.secondaryColor, accent: sgAny.accentColor, background: sgAny.backgroundColor }) : null,
                font: sgAny?.headingFont || null,
                brandNote: [brainOk ? brainImageNote(brain!.data) : "", adCraftNote(userAsk, brainOk ? brain!.data : null)].filter(Boolean).join("\n\n"),
                matchHint,
                productImage: productImage || null,
              });
              packImage = out.url;
              packUsed = { id: pack.id, refIndex: out.refIndex };
              console.log("[CHAT] 📦 Used ad pack", pack.number, "reference", out.refIndex + 1);
            } catch (packErr) {
              console.error("[CHAT] ad pack generation failed, falling back:", packErr);
            }
          }
        }
        if (refs.length === 0 && !packImage) {
          const template = await getRandomTemplateAsBase64();
          if (template) {
            refs = [template];
            console.log("[CHAT] 📸 No brand references at all — using a built-in template as fallback");
          } else {
            console.log("[CHAT] 📸 No brand references and no templates available — generating text-only");
          }
        }

// Map platform to image size
const platformSizes: Record<string, string> = {
  instagram_portrait: "1080x1350",
  facebook_portrait: "1080x1350",
  linkedin_portrait: "1080x1350",
  instagram_post: "1080x1080",
  instagram_story: "1080x1920",
  instagram_reel: "1080x1920",
  tiktok: "1080x1920",
  twitter: "1600x900",
  linkedin_post: "1200x627",
  facebook: "1200x630",
  youtube_thumbnail: "1280x720",
  pinterest: "1000x1500",
  threads: "1080x1080",
  snapchat: "1080x1920",
};
const imageSize = thumbReq ? `${thumbSpecNow.w}x${thumbSpecNow.h}` : platformSizes[platform] || "1080x1080";
console.log("[CHAT] 📐 Platform:", platform, "→ Size:", imageSize);
const imageResponse = packImage ? { url: packImage } : await generateImage(
  imagePrompt,
  imageSize,
  refs,
  fullStyleGuide,
  platform,
  loadedBrand?.name || null,
  loadedBrand?.logo || null,
  loadedBrand?.logoPosition || null,
  loadedBrand?.logoScale || null,
  productImage || null,
  imageProvider || null
);

        imageUrl = imageResponse.url;
        // 4:5 portrait: the model renders 2:3, so trim it to a true 4:5.
        if (imageSize === "1080x1350" && !packImage) imageUrl = await trimToAspect(imageUrl, "4:5").catch(() => imageUrl);
        if (loadedBrand?.logo) {
          imageLogo = {
            url: loadedBrand.logo,
            position: (loadedBrand.logoPosition as string) || "bottom-right",
            scale: loadedBrand.logoScale ?? 0.14,
          };
        }
        console.log("[CHAT] ✅ Image URL:", imageUrl?.slice(0, 80));
      } catch (err) {
        console.error("[CHAT] ❌ Auto image generation failed:", err);
      }
    }

    // ---- BILLING: charge only for what actually ran (a chat-only reply doesn't pay for an image).
    try {
      await commit(
        session.user.id,
        auth,
        [{ key: "chat.text" }, ...(imageUrl ? [{ key: likelyImageKey }] : [])],
        { ref: billingRef, producedImage: !!imageUrl }
      );
    } catch (billErr) {
      console.error("[CHAT] ⚠️ billing commit failed (response still returned):", billErr);
    }

    // Save the design (storage + Files tab) so it survives a refresh.
    let generationId: string | null = null;
    if (imageUrl) {
      const lastUser = [...(messages as AIMessage[])].reverse().find((m) => m.role === "user");
      const saved = await saveGeneration({
        userId: session.user.id,
        brandId: lookupId || null,
        kind: "image",
        title: typeof lastUser?.content === "string" ? lastUser.content.slice(0, 120) : "Design",
        imageUrls: [imageUrl],
        prompt: imagePrompt || null,
        meta: { platform, source: "chat", ...(packUsed ? { pack: packUsed } : {}) },
      });
      imageUrl = saved.imageUrls[0];
      generationId = saved.id;
    }

    console.log("[CHAT] 📤 Returning response with imageUrl:", imageUrl ? "YES" : "NO");

    return NextResponse.json({
      content: response.content,
      model: response.model,
      imageUrl,
      generationId,
      logo: imageLogo,
      usage: response.usage,
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}

// Every AI call in this request is measured for real-cost billing.
export const POST = withUsage(handlePOST);
