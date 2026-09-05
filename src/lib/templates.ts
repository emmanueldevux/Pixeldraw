// ============================================================
// UXLLY — Built-in Reference Templates
// Fallback references for brands that haven't uploaded their own.
// Drop PNGs into /public/templates/ using the exact filenames below —
// see /public/templates/README.md for details.
// ============================================================

export interface TemplateReference {
  id: string;
  name: string;
  filename: string;
  publicUrl: string; // served directly by Next.js from /public
}

export const TEMPLATE_REFERENCES: TemplateReference[] = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  return {
    id: `template-${n}`,
    name: `Template ${n}`,
    filename: `reference${n}.png`,
    publicUrl: `/templates/reference${n}.png`,
  };
});

// ==================== Server-side: random fallback ====================
// Used by the generation pipeline when a brand has no references of its
// own at all — picks one template at random and returns it as a base64
// data URL, matching the format the rest of the pipeline expects
// (see prepareDesaturatedReference, extractVisualDNA, etc. — all assume
// data: URLs, not plain file paths).
//
// This is a per-generation fallback only — it does NOT get saved to the
// brand's own reference board or generation pool in the database.

export async function getRandomTemplateAsBase64(): Promise<string | null> {
  // Node-only imports, safe here since this function only ever runs
  // server-side (API routes), never in a client component.
  const fs = await import("fs/promises");
  const path = await import("path");

  const template = TEMPLATE_REFERENCES[Math.floor(Math.random() * TEMPLATE_REFERENCES.length)];
  const filePath = path.join(process.cwd(), "public", "templates", template.filename);

  try {
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString("base64");
    console.log("[TEMPLATES] 🎲 Using fallback template:", template.name);
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    // File genuinely missing (e.g. templates haven't been added to the
    // folder yet) — fail gracefully to text-only generation rather than
    // crashing the whole request.
    console.warn("[TEMPLATES] Could not load template file:", template.filename, "— has it been added to /public/templates/?", err);
    return null;
  }
}