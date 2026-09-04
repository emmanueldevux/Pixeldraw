// ============================================================
// UXLLY — Inspiration Library Page
// Manual add-by-URL for now. A swipe-style batch tagging tool
// (upload 100s at once, swipe + tap tags) is the planned upgrade
// once the library is proven out — this page is the v1.
// ============================================================

"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Sparkles, Trash2, ImageOff } from "lucide-react";
import { PLATFORM_PRESETS } from "@/lib/platforms";
import type { InspirationImageData } from "@/types";

// ==================== Tag Options ====================
// Freeform is supported via typing, these are just quick picks

const STYLE_OPTIONS = [
  "minimal", "maximalist", "editorial", "3d render", "flat illustration",
  "photographic", "collage", "brutalist", "retro", "glassmorphism",
];

const MOOD_OPTIONS = [
  "energetic", "calm", "luxury", "playful", "bold", "professional", "dreamy", "gritty",
];

export default function InspirationPage() {
  const [images, setImages] = useState<InspirationImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    url: "",
    platform: "",
    style: "",
    mood: "",
    industry: "",
    tags: "",
  });

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inspiration");
      const json = await res.json();
      if (json.success) setImages(json.data);
    } catch (err) {
      console.error("Failed to load inspiration library:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  async function handleAdd() {
    if (!form.url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: form.url.trim(),
          platform: form.platform || null,
          style: form.style || null,
          mood: form.mood || null,
          industry: form.industry || null,
          tags: form.tags
            ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setForm({ url: "", platform: "", style: "", mood: "", industry: "", tags: "" });
        loadImages();
      }
    } catch (err) {
      console.error("Failed to add inspiration image:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
    try {
      await fetch(`/api/inspiration?id=${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete inspiration image:", err);
      loadImages();
    }
  }

  const platformOptions = [
    { value: "", label: "Any platform" },
    ...Object.values(PLATFORM_PRESETS).map((p) => ({ value: p.key, label: p.name })),
  ];

  return (
    <>
      <DashboardHeader
        title="Inspiration Library"
        subtitle="A curated pool the AI borrows one technique from — style stays locked to each brand's own references"
        onMenuClick={() => {}}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowAddModal(true)}
          >
            Add Reference
          </Button>
        }
      />

      <div className="uxlly-content">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-ink-400 text-sm">
            Loading library...
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-ink-300" />
            </div>
            <h3 className="text-lg font-semibold text-ink-900 mb-1">
              Your inspiration library is empty
            </h3>
            <p className="text-sm text-ink-400 max-w-sm mb-6">
              Add reference images here — tag each with a platform, style, and mood.
              The AI pulls a small matching pool and quietly borrows one technique
              (never colors or fonts) to keep brand generations feeling fresh.
            </p>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>
              Add your first reference
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img) => (
              <Card key={img.id} padding="none" className="overflow-hidden group relative">
                <div className="aspect-square bg-surface-100 overflow-hidden">
                  {img.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.url}
                      alt="Inspiration reference"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff size={20} className="text-ink-300" />
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {img.platform && <Badge variant="brand">{img.platform}</Badge>}
                    {img.style && <Badge variant="neutral">{img.style}</Badge>}
                    {img.mood && <Badge variant="neutral">{img.mood}</Badge>}
                  </div>
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-ink-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ==================== Add Reference Modal ==================== */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Inspiration Reference"
      >
        <div className="space-y-4">
          <Input
            label="Image URL"
            placeholder="https://..."
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            hint="Paste a hosted image URL for now. Direct upload comes with the batch tagging tool."
          />

          <Select
            label="Platform"
            options={platformOptions}
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Style"
              options={[{ value: "", label: "None" }, ...STYLE_OPTIONS.map((s) => ({ value: s, label: s }))]}
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
            />
            <Select
              label="Mood"
              options={[{ value: "", label: "None" }, ...MOOD_OPTIONS.map((m) => ({ value: m, label: m }))]}
              value={form.mood}
              onChange={(e) => setForm({ ...form, mood: e.target.value })}
            />
          </div>

          <Input
            label="Industry (optional)"
            placeholder="e.g. fitness, saas, fashion"
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
          />

          <Input
            label="Extra tags (optional)"
            placeholder="comma, separated, tags"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleAdd}>
              Add to Library
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
