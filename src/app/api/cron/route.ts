// ============================================================
// UXLLY — Vercel Cron Handler
// Runs scheduled jobs: generate content + deliver
// Configure in vercel.json: "crons": [{ "path": "/api/cron", "schedule": "0 9,17 * * *" }]
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/skills";
import { openaiGenerateImage } from "@/lib/ai/providers/openai";
import { sendContentEmail } from "@/lib/delivery/email";
import { sendTelegramContent } from "@/lib/delivery/telegram";
import { extractImagePrompt } from "@/lib/utils";
import type { AIMessage, ImageSize } from "@/types";
import type { LogoPosition } from "@/lib/ai/logoComposite";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all active jobs
    const jobs = await db.job.findMany({
      where: { isActive: true },
      include: {
        channel: { include: { brand: { include: { styleGuide: true } } } },
        user: true,
      },
    });

    const results = [];

    for (const job of jobs) {
      try {
        // Build system prompt
        const systemPrompt = buildSystemPrompt(
          ["copywriting", "imagePrompt"],
          {
            brandName: job.channel.brand.name,
            platform: job.platform,
            styleGuide: job.channel.brand.styleGuide
              ? {
                  primaryColor: job.channel.brand.styleGuide.primaryColor,
                  secondaryColor: job.channel.brand.styleGuide.secondaryColor,
                  accentColor: job.channel.brand.styleGuide.accentColor,
                  backgroundColor: job.channel.brand.styleGuide.backgroundColor ?? undefined,
                  headingFont: job.channel.brand.styleGuide.headingFont,
                  tone: job.channel.brand.styleGuide.tone as unknown as
                    | "professional" | "casual" | "bold" | "minimal" | "playful"
                    | undefined,
                  extraNotes: job.channel.brand.styleGuide.extraNotes ?? undefined,
                  rawMarkdown: job.channel.brand.styleGuide.rawMarkdown ?? undefined,
                }
              : null,
          }
        );

        // Generate copy
        const messages: AIMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: job.prompt },
        ];

        const aiResponse = await aiComplete({ messages });

        // Generate image if prompt extracted
        let imageUrl: string | undefined;
        const imagePrompt = extractImagePrompt(aiResponse.content);
        if (imagePrompt) {
          const brand = job.channel.brand;
          const img = await openaiGenerateImage({
            prompt: imagePrompt,
            size: (job.size || "1080x1080") as ImageSize,
            styleGuide: brand.styleGuide
              ? {
                  primaryColor: brand.styleGuide.primaryColor,
                  secondaryColor: brand.styleGuide.secondaryColor,
                  accentColor: brand.styleGuide.accentColor,
                  backgroundColor: brand.styleGuide.backgroundColor ?? undefined,
                  headingFont: brand.styleGuide.headingFont,
                  tone: brand.styleGuide.tone as unknown as
                    | "professional" | "casual" | "bold" | "minimal" | "playful",
                }
              : null,
            logoUrl: brand.logo || null,
            logoPosition: (brand.logoPosition as unknown as LogoPosition) || undefined,
            logoScale: brand.logoScale ?? undefined,
          });
          imageUrl = img.url;
        }

        // Save as post
        await db.post.create({
          data: {
            channelId: job.channelId,
            caption: aiResponse.content,
            imageUrl,
            platform: job.platform,
            size: job.size,
            status: "draft",
          },
        });

        // Deliver
        if (job.deliveryEmail && job.user.email) {
          await sendContentEmail({
            to: job.user.email,
            subject: `New content: ${job.name}`,
            caption: aiResponse.content,
            imageUrl,
            platform: job.platform,
            brandName: job.channel.brand.name,
          });
        }

        if (job.deliveryTelegram && job.telegramChatId) {
          await sendTelegramContent({
            chatId: job.telegramChatId,
            caption: aiResponse.content,
            imageUrl,
            platform: job.platform,
          });
        }

        // Update last run time
        await db.job.update({
          where: { id: job.id },
          data: { lastRunAt: new Date() },
        });

        results.push({ jobId: job.id, status: "success" });
      } catch (err) {
        console.error(`Job ${job.id} failed:`, err);
        results.push({ jobId: job.id, status: "failed", error: String(err) });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
