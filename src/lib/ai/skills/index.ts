// ============================================================
// UXLLY — AI Skills (Prompt Engineering)
// Skills enhance prompts with context, style, and expertise
// ============================================================

import { copywritingSkill } from "./copywriting";
import { imagePromptSkill } from "./imagePrompt";
import { inspirationInjectionSkill } from "./inspirationInjection";
import { typographySkill } from "./typography";
import type { StyleGuideData } from "@/types";

export type SkillName = "copywriting" | "imagePrompt" | "inspirationInjection" | "typography";

// ==================== Skill Registry ====================

export const skills: Record<SkillName, SkillDefinition> = {
  copywriting: copywritingSkill,
  imagePrompt: imagePromptSkill,
  inspirationInjection: inspirationInjectionSkill,
  typography: typographySkill,
};

export interface SkillDefinition {
  name: string;
  description: string;
  buildSystemPrompt: (context: SkillContext) => string;
}

export interface SkillContext {
  brandName: string;
  platform: string;
  styleGuide?: Partial<StyleGuideData> | null;
  channelDescription?: string;
  extraInstructions?: string;
}

// ==================== Build System Prompt With Skills ====================

export function buildSystemPrompt(
  skillNames: SkillName[],
  context: SkillContext
): string {
  const parts = [
    `You are Uxlly AI, a professional content creation assistant.`,
    `You are creating content for the brand "${context.brandName}" on ${context.platform}.`,
  ];

  // Add channel context
  if (context.channelDescription) {
    parts.push(`Channel description: ${context.channelDescription}`);
  }

  // Add style guide context
  if (context.styleGuide) {
    parts.push(buildStyleGuideContext(context.styleGuide));
  }

  // Add skill-specific instructions
  for (const skillName of skillNames) {
    const skill = skills[skillName];
    if (skill) {
      parts.push(skill.buildSystemPrompt(context));
    }
  }

  // Add extra instructions
  if (context.extraInstructions) {
    parts.push(`Additional instructions: ${context.extraInstructions}`);
  }

  return parts.join("\n\n");
}

// ==================== Style Guide Context Builder ====================

function buildStyleGuideContext(
  guide: Partial<StyleGuideData>
): string {
  const lines = ["## Brand Style Guide"];

  if (guide.primaryColor)
    lines.push(`Primary color: ${guide.primaryColor}`);
  if (guide.secondaryColor)
    lines.push(`Secondary color: ${guide.secondaryColor}`);
  if (guide.accentColor)
    lines.push(`Accent color: ${guide.accentColor}`);
  if (guide.headingFont)
    lines.push(`Heading font: ${guide.headingFont}`);
  if (guide.bodyFont)
    lines.push(`Body font: ${guide.bodyFont}`);
  if (guide.tone)
    lines.push(`Brand tone: ${guide.tone}`);
  if (guide.extraNotes)
    lines.push(`Style notes: ${guide.extraNotes}`);
  if (guide.rawMarkdown) {
    lines.push(`\n## Visual Style Analysis (from reference images)\nThis was extracted by analyzing the brand's reference images. Follow these rules closely when generating image prompts:\n${guide.rawMarkdown}`);
  }

  return lines.join("\n");
}