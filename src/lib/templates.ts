// ============================================================
// UXLLY — Built-in Reference Templates
// Fallback references for brands that haven't uploaded their own.
//
// Drop ANY image files into /public/templates/ — any names, any mix of
// .png/.jpg/.jpeg/.webp/.gif. This scans the folder at request time and
// picks up whatever's actually there, so there's no renaming required
// and no fixed count to hit.
// ============================================================

import path from "path";
import fs from "fs/promises";

export interface TemplateReference {
  id: string;
  name: string;
  filename: string;
  publicUrl: string; // served directly by Next.js from /public
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function mimeTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

function nameFromFilename(filename: string): string {
  // "7.jpeg" -> "7", "sunset-poster.png" -> "sunset poster"
  const base = path.basename(filename, path.extname(filename));
  const cleaned = base.replace(/[-_]+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) || "Template";
}

// ==================== List available templates ====================
// Server-only — scans the actual folder contents. Used both by the
// /api/templates route (for the picker modal) and internally by the
// random-fallback picker below.

export async function listAvailableTemplates(): Promise<TemplateReference[]> {
  const dir = path.join(process.cwd(), "public", "templates");

  try {
    const files = await fs.readdir(dir);
    const images = files.filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()));

    return images
      .sort() // stable order across requests
      .map((filename) => ({
        id: filename,
        name: nameFromFilename(filename),
        filename,
        publicUrl: `/templates/${filename}`,
      }));
  } catch (err) {
    console.warn("[TEMPLATES] Could not read /public/templates/ folder:", err);
    return [];
  }
}

// ==================== Server-side: random fallback ====================
// Used by the generation pipeline when a brand has no references of its
// own at all — picks one available template at random and returns it as
// a base64 data URL, matching the format the rest of the pipeline
// expects (see prepareDesaturatedReference, extractVisualDNA, etc. — all
// assume data: URLs, not plain file paths).
//
// This is a per-generation fallback only — it does NOT get saved to the
// brand's own reference board or generation pool in the database.

export async function getRandomTemplateAsBase64(): Promise<string | null> {
  const templates = await listAvailableTemplates();
  if (templates.length === 0) {
    console.warn("[TEMPLATES] No template images found in /public/templates/ — falling back to text-only generation");
    return null;
  }

  const template = templates[Math.floor(Math.random() * templates.length)];
  const filePath = path.join(process.cwd(), "public", "templates", template.filename);

  try {
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString("base64");
    const mime = mimeTypeFor(template.filename);
    console.log("[TEMPLATES] 🎲 Using fallback template:", template.name, `(${mime})`);
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.warn("[TEMPLATES] Could not read template file:", template.filename, err);
    return null;
  }
}