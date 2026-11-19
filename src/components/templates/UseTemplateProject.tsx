// ============================================================
// "Use template" for reference packs: a template is a project.
// Pick one of your projects (the template is added to it and the AI studio opens)
// or create a new one: the setup wizard runs with the template already chosen.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import OnboardingModal, { type ProjectKind } from "@/components/projects/OnboardingModal";
import { useAuthGate } from "@/components/auth/AuthGate";
import type { PublicTemplate } from "@/lib/designTemplates/types";

interface P { id: string; name: string; channels: { id: string; platform: string }[] }

const KIND_OF = (t: PublicTemplate): ProjectKind => (t.category === "Thumbnails" ? "thumbnails" : t.category === "Carousels" ? "carousels" : t.category === "Slideshows" ? "slideshows" : "ads");
// Which of the user's projects can hold this kind (by the channel platform).
const FITS = (kind: ProjectKind, platform: string) => (kind === "thumbnails" ? platform === "youtube_thumbnail" : kind === "slideshows" ? platform === "tiktok" : platform !== "youtube_thumbnail" && platform !== "tiktok");

export default function UseTemplateProject({ template, onClose }: { template: PublicTemplate; onClose: () => void }) {
  const router = useRouter();
  const { requireAuth } = useAuthGate();
  const kind = KIND_OF(template);
  const [projects, setProjects] = useState<P[] | null>(null);
  const [pick, setPick] = useState<string>("new");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => {
        const list: P[] = (d.data || []).map((b: { id: string; brandName?: string; name?: string; channels?: { id: string; platform: string }[] }) => ({ id: b.id, name: b.brandName || b.name || "Project", channels: b.channels || [] }));
        // Only projects that can hold this kind of template (thumbnail projects for thumbnails, the rest for ads).
        const fit = list.filter((p) => p.channels.length > 0 && p.channels.some((c) => FITS(kind, c.platform)));
        setProjects(fit);
        if (fit.length) setPick(fit[0].id);
      })
      .catch(() => setProjects([]));
  }, [kind]);

  async function addToProject() {
    const p = projects?.find((x) => x.id === pick);
    if (!p) return;
    setBusy(true);
    setErr(null);
    try {
      // Merge into the project's existing settings (the save replaces the whole block).
      const cur = await fetch(`/api/projects/style?brandId=${p.id}`).then((r) => r.json());
      const adv = (cur?.data?.advancedSettings || {}) as Record<string, unknown>;
      const next: Record<string, unknown> =
        kind === "thumbnails" ? { ...adv, thumbPackId: template.id }
        : kind === "carousels" ? { ...adv, carousel: { ...((adv.carousel as object) || {}), styleId: template.id } }
        : kind === "slideshows" ? { ...adv, slideshowStyleId: template.id }
        : { ...adv, adPackId: template.id };
      const res = await fetch("/api/projects/style", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId: p.id, advancedSettings: next }) });
      if (!res.ok) throw new Error("save");
      const channel = p.channels.find((c) => FITS(kind, c.platform)) || p.channels[0];
      router.push(`/ai?channel=${channel.id}`);
      onClose();
    } catch {
      setErr("Couldn't add the template to that project. Try again.");
      setBusy(false);
    }
  }

  function go() {
    if (!requireAuth()) return;
    if (pick === "new") setWizard(true);
    else void addToProject();
  }

  if (wizard) return <OnboardingModal isOpen onClose={onClose} kind={kind} presetPackId={template.id} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{template.number >= 100 ? template.category.replace(/s$/, "") : `Template ${template.number}`}</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{template.title}</h2>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="mt-3 text-sm text-gray-600">This template becomes part of a project, so everything you make with it lives in your projects.</p>

        <p className="mt-5 text-sm font-semibold text-gray-900 mb-2">Add it to</p>
        {projects === null ? (
          <div className="py-3"><Loader2 className="animate-spin text-gray-400" size={18} /></div>
        ) : (
          <select className="w-full h-12 rounded-xl border border-gray-200 px-3 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="new">+ Create a new project</option>
          </select>
        )}
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <button onClick={go} disabled={busy || projects === null} className="mt-6 w-full h-12 rounded-xl bg-[#2B2B2B] hover:bg-black text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {pick === "new" ? "Set up my project" : "Open in my project"}
        </button>
      </div>
    </div>
  );
}
