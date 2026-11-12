// ============================================================
// UXLLY — Project card destination
// Opening a project goes straight to AI Studio with that project
// selected (settings on the right, chat in the middle).
// ============================================================

import { redirect } from "next/navigation";

export default function ProjectPage({ params }: { params: { id: string } }) {
  redirect(`/ai?channel=${encodeURIComponent(params.id)}`);
}