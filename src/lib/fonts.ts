// ============================================================
// UXLLY — Curated Font Options
// gpt-image-2 can't load actual font files — it renders text
// based on a STYLE DESCRIPTION, not a font name alone. Each entry
// pairs a familiar font name with a style descriptor that
// actually steers the image model toward the right look.
// ============================================================

export interface FontOption {
  name: string; // display name, also saved as StyleGuide.headingFont
  styleDescriptor: string; // fed into the generation prompt instead of just the name
  sample: string; // short label for UI preview
}

export const FONT_OPTIONS: FontOption[] = [
  {
    name: "Inter",
    styleDescriptor: "clean modern neutral sans-serif, excellent legibility, tech-native feel",
    sample: "Inter",
  },
  {
    name: "Roboto",
    styleDescriptor: "neutral humanist sans-serif, friendly and highly legible, Android-native feel",
    sample: "Roboto",
  },
  {
    name: "Poppins",
    styleDescriptor: "geometric sans-serif with soft, rounded, friendly curves",
    sample: "Poppins",
  },
  {
    name: "Montserrat",
    styleDescriptor: "elegant geometric sans-serif with an urban, sophisticated feel",
    sample: "Montserrat",
  },
  {
    name: "Raleway",
    styleDescriptor: "elegant thin/light-weight sans-serif, refined and minimal",
    sample: "Raleway",
  },
  {
    name: "Nunito",
    styleDescriptor: "rounded soft sans-serif, warm and friendly, gentle curves",
    sample: "Nunito",
  },
  {
    name: "Oswald",
    styleDescriptor: "tall, narrow, condensed proportions — its headline presence comes from height and narrowness, not necessarily heavy stroke weight",
    sample: "Oswald",
  },
  {
    name: "Source Sans 3",
    styleDescriptor: "clean readable sans-serif, professional and understated",
    sample: "Source Sans",
  },
  {
    name: "Fira Sans",
    styleDescriptor: "humanist sans-serif with a technical, code-adjacent feel",
    sample: "Fira Sans",
  },
  {
    name: "Lato",
    styleDescriptor: "warm humanist sans-serif, balanced and versatile",
    sample: "Lato",
  },
  {
    name: "Playfair Display",
    styleDescriptor: "high-contrast serif, elegant and editorial, luxury feel",
    sample: "Playfair",
  },
  {
    name: "JetBrains Mono",
    styleDescriptor: "monospace, technical and precise, developer-tool feel",
    sample: "JetBrains Mono",
  },
];

export function getFontStyleDescriptor(fontName: string | null | undefined): string {
  const match = FONT_OPTIONS.find((f) => f.name === fontName);
  return match?.styleDescriptor || "clean modern sans-serif";
}
