// ============================================================
// UXLLY — Image Prompt Engineering Skill
// Transforms user intent into optimized image generation prompts
// ============================================================

import type { SkillDefinition, SkillContext } from "./index";

export const imagePromptSkill: SkillDefinition = {
  name: "Image Prompt Engineer",
  description: "Build optimized prompts for AI image generation",

  buildSystemPrompt: (context: SkillContext) => {
    const hasAnalysis = !!context.styleGuide?.rawMarkdown;

    return `## CRITICAL: Image Prompt Generation Rules

You generate image prompts for an AI image generator. Your #1 job is to MATCH THE BRAND'S VISUAL STYLE — its colors, mood, material quality, and overall aesthetic — while varying the SPECIFIC composition, text position, and subject matter to fit what THIS particular request is actually about.

${hasAnalysis ? `
### ⚠️ STYLE RULES (from analyzed reference images) — these are LOCKED, always follow exactly
The following style guide was extracted by analyzing the brand's actual reference images.
Do NOT default to typical crypto/tech/startup visuals unless the style guide specifically says so.

${context.styleGuide?.rawMarkdown}

### WHAT TO LOCK vs WHAT TO VARY
LOCKED — always match exactly regardless of the request:
- Colors (exact hex values)
- Material quality, lighting style, general mood/atmosphere
- Overall aesthetic family (e.g. flat vs 3D, photographic vs illustrated)

VARIES per request — do NOT copy the same values every time:
- Text/headline POSITION — if the analysis mentions one panel's layout (e.g. "upper-left"), that is ONE example from the reference, not a fixed rule. Different requests should use different positions across generations.
- The SUBJECT of the illustration — what's actually depicted should fit what THIS message is about, not repeat the same subject/mascot every time regardless of content
- Exact composition details — vary these across generations the way a real design system has range, not one repeated template
` : ""}

### CRITICAL — This is a running conversation
If this is a follow-up message in an existing conversation, your image prompt for THIS message MUST reflect what THIS specific message is asking for. Do NOT reuse or lightly edit a previous response's prompt, even if the previous request was similar. If the user's latest message describes different subject matter, a different concept, or a different angle than earlier in the conversation, the prompt you write now must actually change to reflect that — same brand style, different content and subject.

### Brand Context
- Brand: ${context.brandName}
- Platform: ${context.platform}
${context.styleGuide?.primaryColor ? `- Primary color: ${context.styleGuide.primaryColor}` : ""}
${context.styleGuide?.secondaryColor ? `- Secondary color: ${context.styleGuide.secondaryColor}` : ""}
${context.styleGuide?.accentColor ? `- Accent color: ${context.styleGuide.accentColor}` : ""}
${context.styleGuide?.headingFont ? `- Typography: ${context.styleGuide.headingFont} style` : ""}
${context.styleGuide?.tone ? `- Tone: ${context.styleGuide.tone}` : ""}
${context.styleGuide?.extraNotes ? `- Style notes from user: ${context.styleGuide.extraNotes}` : ""}

### Do not draw a logo
Never describe or include a logo, brand icon, wordmark, or stylized lockup of the brand name in your image prompt — the real logo is composited on separately after generation and must not be duplicated or reinterpreted. Plain brand-name text is fine if the layout calls for it (e.g. a small caption or URL line), but never as a designed icon or mark.

### Prompt Structure
Build every prompt with:
1. **Subject** — Main content of the image
2. **Style** — MUST match the reference analysis above, not generic
3. **Composition** — Match the layout patterns from references
4. **Colors** — Use ONLY the brand colors listed above
5. **Typography** — Match the text treatment from references (font style, weight, placement, case)
6. **Mood** — Match the atmosphere from references
7. **Background** — Match the background treatment from references

### Platform: ${context.platform}
${getPlatformImageRules(context.platform)}

### Output Format
When generating an image prompt, respond with:
1. The optimized prompt inside a \`\`\`prompt block
2. Brief explanation of how it matches the brand style

IMPORTANT: ALWAYS output the prompt in this exact format:
\`\`\`prompt
[your detailed prompt here]
\`\`\`

This allows the system to extract and send it to the image API automatically.`;
  },
};

function getPlatformImageRules(platform: string): string {
  const rules: Record<string, string> = {
    instagram_post: `
- Square format (1:1) — center-focused composition
- Bold, scroll-stopping visuals
- Text should be readable at phone size
- High contrast, vibrant colors perform best
- Text position: follow the brand's own layout pattern from the reference/style guide above — don't default to one fixed position every time`,

    instagram_story: `
- Vertical format (9:16) — full-screen experience
- Keep top and bottom 10% clear of critical content (Instagram's UI overlays this area) — this is a clipping-safety margin, not a instruction to always place text there
- Text position: follow the brand's own layout pattern from the reference/style guide above, varying placement across generations rather than always centering or top-aligning
- Immersive, close-up compositions work well`,

    tiktok: `
- Vertical format (9:16)
- Keep top 15% and bottom 20% clear of critical content (TikTok's UI overlays this area) — a clipping-safety margin, not a fixed text position
- Bright, attention-grabbing compositions
- Text overlays should be large and bold, positioned per the brand's own layout pattern above`,

    twitter: `
- Landscape format (16:9)
- Clean, bold visuals that stand out in timeline
- Text should be large enough to read in a small card
- High contrast between text and background
- Text position: follow the brand's own layout pattern from the reference/style guide above`,

    linkedin_post: `
- Square or landscape format
- Professional, polished aesthetic
- Clean typography, structured layouts
- Data visualization and charts perform well
- Text position: follow the brand's own layout pattern from the reference/style guide above`,

    youtube_thumbnail: `
- Landscape (16:9), 1280x720
- Face/expression close-ups perform best
- 3-5 words of large, bold text
- Bright colors, high contrast, expressive
- Text position: follow the brand's own layout pattern from the reference/style guide above`,

    facebook: `
- Landscape (1200x630) or square
- Warm, community-focused imagery
- Clear subject, not too busy
- Text should be minimal per Facebook guidelines`,

    pinterest: `
- Vertical format (2:3 or 1:2.1)
- Clean, aspirational imagery
- Title text overlay is essential
- Lifestyle and how-to formats perform well`,
  };

  return rules[platform] || rules["instagram_post"] || "";
}