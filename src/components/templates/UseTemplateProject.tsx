// ============================================================
// "Use template" for reference packs: a template is a project.
// Opens the project setup with the template already chosen as the reference pack.
// The user can add details, or borrow an existing project's brain. Confirming creates
// a new project and opens the AI studio on it.
// ============================================================
"use client";

import OnboardingModal, { type ProjectKind } from "@/components/projects/OnboardingModal";
import type { PublicTemplate } from "@/lib/designTemplates/types";

export const kindOfTemplate = (t: Pick<PublicTemplate, "category">): ProjectKind =>
  t.category === "Thumbnails" ? "thumbnails" : t.category === "Carousels" ? "carousels" : t.category === "Slideshows" ? "slideshows" : "ads";

export default function UseTemplateProject({ template, onClose }: { template: PublicTemplate; onClose: () => void }) {
  return <OnboardingModal isOpen onClose={onClose} kind={kindOfTemplate(template)} presetPackId={template.id} templateName={template.title} />;
}
