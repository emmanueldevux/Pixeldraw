// ============================================================
// UXLLY — Settings Page
// Brands & Style Guides + API Keys + Delivery Config
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { FONT_OPTIONS } from "@/lib/fonts";
import {
  Save, Key, Mail, Send, Globe, Palette, Upload,
  Trash2, ChevronDown, ChevronUp, Pencil, X, Image as ImageIcon,
} from "lucide-react";

// ==================== Types ====================
interface StyleGuideData {
  id: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string | null;
  headingFont: string;
  tone: string;
  extraNotes: string | null;
  referenceImages: string[] | null;
}

interface ChannelData {
  id: string;
  name: string;
  platform: string;
  description: string | null;
}

interface BrandData {
  id: string;
  name: string;
  logo: string | null;
  logoPosition: string | null;
  logoScale: number | null;
  styleGuide: StyleGuideData | null;
  channels: ChannelData[];
}

export default function SettingsPage() {
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [editingStyle, setEditingStyle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable style state
  const [editNotes, setEditNotes] = useState("");
  const [editTone, setEditTone] = useState("professional");
  const [editPrimary, setEditPrimary] = useState("#2563EB");
  const [editSecondary, setEditSecondary] = useState("#1D4ED8");
  const [editAccent, setEditAccent] = useState("#22C55E");
  const [editBackground, setEditBackground] = useState("#0A0A0A");
  const [enforceBackground, setEnforceBackground] = useState(false);
  const [editFont, setEditFont] = useState("Inter");
  const [newReferences, setNewReferences] = useState<string[]>([]);

  // Logo editing state
  const [newLogo, setNewLogo] = useState<string | null>(null);
  const [editLogoPosition, setEditLogoPosition] = useState("bottom-right");
  const [editLogoScale, setEditLogoScale] = useState(0.14);
  const [savingLogo, setSavingLogo] = useState(false);

  // ==================== Fetch Brands ====================
  const fetchBrands = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success) setBrands(data.data || []);
    } catch (err) {
      console.error("Failed to fetch brands:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  // ==================== Start Editing ====================
  const startEditing = (brand: BrandData) => {
    setEditingStyle(brand.id);
    setExpandedBrand(brand.id);
    const sg = brand.styleGuide;
    setEditNotes(sg?.extraNotes || "");
    setEditTone(sg?.tone || "professional");
    setEditPrimary(sg?.primaryColor || "#2563EB");
    setEditSecondary(sg?.secondaryColor || "#1D4ED8");
    setEditAccent(sg?.accentColor || "#22C55E");
    setEditBackground(sg?.backgroundColor || "#0A0A0A");
    setEnforceBackground(!!sg?.backgroundColor);
    setEditFont(sg?.headingFont || "Inter");
    setNewReferences([]);
    setNewLogo(null);
    setEditLogoPosition(brand.logoPosition || "auto");
    setEditLogoScale(brand.logoScale ?? 0.14);
  };

  // ==================== Add Reference Images ====================
  const handleAddReferences = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setNewReferences((prev) => [...prev, reader.result as string].slice(0, 10));
      };
      reader.readAsDataURL(file);
    });
  };

  // ==================== Save Style Guide ====================
  const handleSaveStyle = async (brandId: string) => {
    setSaving(true);
    try {
      const brand = brands.find((b) => b.id === brandId);
      const existingRefs = brand?.styleGuide?.referenceImages || [];
      const allRefs = [...existingRefs, ...newReferences].slice(0, 10);

      await fetch(`/api/projects/style`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          primaryColor: editPrimary,
          secondaryColor: editSecondary,
          accentColor: editAccent,
          backgroundColor: enforceBackground ? editBackground : null,
          headingFont: editFont,
          tone: editTone,
          extraNotes: editNotes,
          referenceImages: allRefs,
        }),
      });

      setEditingStyle(null);
      setNewReferences([]);
      fetchBrands();
    } catch (err) {
      console.error("Failed to save style:", err);
    } finally {
      setSaving(false);
    }
  };

  // ==================== Delete Reference Image ====================
  const handleDeleteRef = async (brandId: string, index: number) => {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand?.styleGuide) return;
    const refs = [...(brand.styleGuide.referenceImages || [])];
    refs.splice(index, 1);

    await fetch(`/api/projects/style`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId,
        referenceImages: refs,
      }),
    });
    fetchBrands();
  };

  // ==================== Delete Brand ====================
  const [deletingBrand, setDeletingBrand] = useState<string | null>(null);

  const handleDeleteBrand = async (brandId: string, brandName: string) => {
    const confirmed = window.confirm(
      `Delete "${brandName}"? This permanently removes the brand, its style guide, all channels, posts, and conversations. This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingBrand(brandId);
    try {
      await fetch(`/api/projects?brandId=${brandId}`, { method: "DELETE" });
      setBrands((prev) => prev.filter((b) => b.id !== brandId));
      if (expandedBrand === brandId) setExpandedBrand(null);
    } catch (err) {
      console.error("Failed to delete brand:", err);
      alert("Failed to delete brand. Check the console for details.");
    } finally {
      setDeletingBrand(null);
    }
  };

  // ==================== Logo Upload / Save ====================
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async (brandId: string) => {
    setSavingLogo(true);
    try {
      await fetch("/api/projects/logo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          ...(newLogo ? { logoBase64: newLogo } : {}),
          logoPosition: editLogoPosition,
          logoScale: editLogoPosition === "auto" ? null : editLogoScale,
        }),
      });
      setNewLogo(null);
      fetchBrands();
    } catch (err) {
      console.error("Failed to save logo settings:", err);
    } finally {
      setSavingLogo(false);
    }
  };

  return (
    <>
      <DashboardHeader title="Settings" subtitle="Manage brands, style guides, and integrations" onMenuClick={() => {}} />

      <div className="uxlly-content max-w-3xl">
        <div className="space-y-6">

          {/* ============================================================
             BRANDS & STYLE GUIDES
             ============================================================ */}
          <div>
            <h2 className="text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <Palette size={20} className="text-brand-500" />
              Brands & Style Guides
            </h2>

            {loading && (
              <Card><div className="flex justify-center py-8"><div className="uxlly-spinner w-6 h-6" /></div></Card>
            )}

            {!loading && brands.length === 0 && (
              <Card>
                <p className="text-sm text-ink-400 text-center py-4">
                  No brands yet. Create a project to get started.
                </p>
              </Card>
            )}

            {brands.map((brand) => {
              const isExpanded = expandedBrand === brand.id;
              const isEditing = editingStyle === brand.id;
              const sg = brand.styleGuide;
              const refs = sg?.referenceImages || [];

              return (
                <Card key={brand.id} className="mb-4">
                  {/* ==================== Brand Header ==================== */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedBrand(isExpanded ? null : brand.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                        <Palette size={18} className="text-brand-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{brand.name}</p>
                        <p className="text-xs text-ink-400">
                          {brand.channels.length} channel{brand.channels.length !== 1 ? "s" : ""} · {refs.length} reference{refs.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(brand); }}
                          className="p-2 rounded-lg hover:bg-surface-100 text-ink-400 hover:text-ink-700 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteBrand(brand.id, brand.name); }}
                        disabled={deletingBrand === brand.id}
                        className="p-2 rounded-lg hover:bg-red-50 text-ink-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Delete brand"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isExpanded ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
                    </div>
                  </div>

                  {/* ==================== Expanded Content ==================== */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-surface-200 space-y-4">

                      {/* Channels list */}
                      <div>
                        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Channels</p>
                        <div className="flex flex-wrap gap-2">
                          {brand.channels.map((ch) => (
                            <Badge key={ch.id} variant="brand">
                              {ch.name} — {ch.platform}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Reference Board */}
                      <div>
                        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
                          Reference Board ({refs.length}/10)
                        </p>
                        {refs.length > 0 ? (
                          <div className="grid grid-cols-4 gap-2">
                            {refs.map((ref, i) => (
                              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-surface-200 group">
                                <img src={ref} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                                {isEditing && (
                                  <button
                                    onClick={() => handleDeleteRef(brand.id, i)}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                            ))}

                            {/* Add more in edit mode */}
                            {isEditing && refs.length + newReferences.length < 10 && (
                              <label className="aspect-square rounded-lg border-2 border-dashed border-surface-200 flex flex-col items-center justify-center cursor-pointer hover:border-brand-300 transition-colors">
                                <Upload size={16} className="text-ink-400 mb-1" />
                                <span className="text-[9px] text-ink-400">Add</span>
                                <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddReferences} />
                              </label>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-4 bg-surface-50 rounded-xl">
                            <ImageIcon size={20} className="text-ink-300" />
                            <p className="text-xs text-ink-400">No reference images yet. Click edit to add some.</p>
                          </div>
                        )}

                        {/* New references preview */}
                        {newReferences.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-ink-400 mb-1">New (unsaved):</p>
                            <div className="grid grid-cols-4 gap-2">
                              {newReferences.map((ref, i) => (
                                <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden border-2 border-brand-200">
                                  <img src={ref} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => setNewReferences((prev) => prev.filter((_, j) => j !== i))}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Logo */}
                      <div>
                        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
                          Logo
                        </p>
                        <p className="text-xs text-ink-400 mb-2">
                          Placed exactly as uploaded on every generation — never redrawn or restyled by the AI.
                        </p>
                        <div className="flex items-start gap-4">
                          <label className={`w-20 h-20 rounded-xl border-2 border-dashed border-surface-200 flex items-center justify-center overflow-hidden shrink-0 ${isEditing ? "cursor-pointer hover:border-brand-300" : ""}`}>
                            {(newLogo || brand.logo) ? (
                              <img src={newLogo || brand.logo || ""} alt="Logo" className="w-full h-full object-contain p-2" />
                            ) : (
                              <ImageIcon size={18} className="text-ink-300" />
                            )}
                            {isEditing && (
                              <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                            )}
                          </label>

                          {isEditing ? (
                            <div className="flex-1 space-y-2">
                              <Select
                                label="Position"
                                value={editLogoPosition}
                                onChange={(e) => setEditLogoPosition(e.target.value)}
                                options={[
                                  { value: "auto", label: "Auto — vary each generation" },
                                  { value: "top-left", label: "Top left" },
                                  { value: "top-right", label: "Top right" },
                                  { value: "bottom-left", label: "Bottom left" },
                                  { value: "bottom-right", label: "Bottom right" },
                                  { value: "top-middle", label: "Top middle" },
                                  { value: "bottom-middle", label: "Bottom middle" },
                                  { value: "center", label: "Center" },
                                ]}
                              />
                              <div className={editLogoPosition === "auto" ? "opacity-40 pointer-events-none" : ""}>
                                <label className="text-xs text-ink-600 mb-1 block">
                                  Size — {Math.round(editLogoScale * 100)}% of canvas width
                                  {editLogoPosition === "auto" && " (auto-picked per position)"}
                                </label>
                                <input
                                  type="range"
                                  min={0.06}
                                  max={0.4}
                                  step={0.01}
                                  value={editLogoScale}
                                  onChange={(e) => setEditLogoScale(parseFloat(e.target.value))}
                                  disabled={editLogoPosition === "auto"}
                                  className="w-full"
                                />
                              </div>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={savingLogo}
                                icon={<Save size={12} />}
                                onClick={() => handleSaveLogo(brand.id)}
                              >
                                Save Logo Settings
                              </Button>
                            </div>
                          ) : (
                            <div className="text-xs text-ink-400">
                              {brand.logo ? (
                                <>
                                  Position: {brand.logoPosition ? brand.logoPosition.replace("-", " ") : "Auto (varies)"}
                                  {brand.logoScale ? ` · Size: ${Math.round(brand.logoScale * 100)}%` : ""}
                                </>
                              ) : (
                                "No logo uploaded yet."
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Style Details (view or edit) */}
                      {isEditing ? (
                        <div className="space-y-3 p-4 bg-surface-50 rounded-xl">
                          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Style Details</p>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs text-ink-600 mb-1 block">Primary</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={editPrimary} onChange={(e) => setEditPrimary(e.target.value)} className="w-7 h-7 rounded border border-surface-200 cursor-pointer" />
                                <span className="text-xs text-ink-500 font-mono">{editPrimary}</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-ink-600 mb-1 block">Secondary</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={editSecondary} onChange={(e) => setEditSecondary(e.target.value)} className="w-7 h-7 rounded border border-surface-200 cursor-pointer" />
                                <span className="text-xs text-ink-500 font-mono">{editSecondary}</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-ink-600 mb-1 block">Accent</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={editAccent} onChange={(e) => setEditAccent(e.target.value)} className="w-7 h-7 rounded border border-surface-200 cursor-pointer" />
                                <span className="text-xs text-ink-500 font-mono">{editAccent}</span>
                              </div>
                            </div>
                            <div className="col-span-3">
                              <label className="text-xs text-ink-600 mb-1 flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={enforceBackground}
                                  onChange={(e) => setEnforceBackground(e.target.checked)}
                                  className="cursor-pointer"
                                />
                                Enforce background color (unchecked = AI decides from the reference)
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={editBackground}
                                  onChange={(e) => setEditBackground(e.target.value)}
                                  disabled={!enforceBackground}
                                  className="w-7 h-7 rounded border border-surface-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                />
                                <span className="text-xs text-ink-500 font-mono">
                                  {enforceBackground ? editBackground : "AI decides"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-ink-600 mb-1 block">Heading Font</label>
                            <div className="grid grid-cols-3 gap-2">
                              {FONT_OPTIONS.map((f) => (
                                <button
                                  key={f.name}
                                  type="button"
                                  onClick={() => setEditFont(f.name)}
                                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                                    editFont === f.name
                                      ? "border-brand-500 bg-brand-50"
                                      : "border-surface-200 hover:border-surface-300"
                                  }`}
                                >
                                  <p
                                    className="text-sm font-semibold text-ink-900 truncate"
                                    style={{ fontFamily: `"${f.name}", sans-serif` }}
                                  >
                                    {f.sample}
                                  </p>
                                  <p className="text-[10px] text-ink-400 truncate">{f.name}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          <Select label="Tone" value={editTone} onChange={(e) => setEditTone(e.target.value)} options={[
                            { value: "professional", label: "Professional" },
                            { value: "casual", label: "Casual" },
                            { value: "bold", label: "Bold" },
                            { value: "minimal", label: "Minimal" },
                            { value: "playful", label: "Playful" },
                          ]} />

                          <div>
                            <label className="text-sm font-medium text-ink-800 mb-1.5 block">Style Notes</label>
                            <textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Dark backgrounds, neon accents, bold sans-serif..."
                              className="uxlly-input min-h-[60px] resize-y"
                              rows={2}
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingStyle(null); setNewReferences([]); }}>Cancel</Button>
                            <Button variant="primary" size="sm" loading={saving} icon={<Save size={14} />} onClick={() => handleSaveStyle(brand.id)}>Save Changes</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Style Details</p>
                          <div className="flex flex-wrap gap-3">
                            {sg?.primaryColor && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full border border-surface-200" style={{ background: sg.primaryColor }} />
                                <span className="text-xs text-ink-500">{sg.primaryColor}</span>
                              </div>
                            )}
                            {sg?.secondaryColor && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full border border-surface-200" style={{ background: sg.secondaryColor }} />
                                <span className="text-xs text-ink-500">{sg.secondaryColor}</span>
                              </div>
                            )}
                            {sg?.accentColor && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full border border-surface-200" style={{ background: sg.accentColor }} />
                                <span className="text-xs text-ink-500">{sg.accentColor}</span>
                              </div>
                            )}
                            {sg?.backgroundColor && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full border border-surface-200" style={{ background: sg.backgroundColor }} />
                                <span className="text-xs text-ink-500">{sg.backgroundColor} (bg)</span>
                              </div>
                            )}
                            {sg?.headingFont && <Badge variant="neutral">{sg.headingFont}</Badge>}
                            {sg?.tone && <Badge variant="brand">{sg.tone}</Badge>}
                          </div>
                          {sg?.extraNotes && <p className="text-xs text-ink-400 mt-2">{sg.extraNotes}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* ============================================================
             API KEYS & INTEGRATIONS
             ============================================================ */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Key size={18} className="text-brand-500" />
              <h3 className="text-base font-semibold text-ink-900">AI Provider</h3>
            </div>
            <div className="space-y-4">
              <Select label="Text AI Provider" options={[
                { value: "deepseek", label: "DeepSeek V3 (cheapest)" },
                { value: "openai", label: "OpenAI GPT-4o" },
                { value: "anthropic", label: "Claude (Anthropic)" },
              ]} defaultValue="deepseek" />
              <Input label="DeepSeek API Key" type="password" placeholder="sk-..." />
              <Input label="OpenAI API Key" type="password" placeholder="sk-..." hint="Required for image generation" />
              <Input label="Anthropic API Key (optional)" type="password" placeholder="sk-ant-..." />
              <Button variant="primary" size="sm" icon={<Save size={14} />}>Save API Keys</Button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Mail size={18} className="text-brand-500" />
              <h3 className="text-base font-semibold text-ink-900">Email Delivery</h3>
            </div>
            <div className="space-y-4">
              <Input label="SMTP Host" placeholder="smtp.gmail.com" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="SMTP User" placeholder="you@gmail.com" />
                <Input label="SMTP Password" type="password" placeholder="App password" />
              </div>
              <Button variant="primary" size="sm" icon={<Save size={14} />}>Save Email Settings</Button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Send size={18} className="text-brand-500" />
              <h3 className="text-base font-semibold text-ink-900">Telegram</h3>
            </div>
            <div className="space-y-4">
              <Input label="Bot Token" type="password" placeholder="123456:ABC-..." />
              <Input label="Default Chat ID" placeholder="-1001234567890" />
              <Button variant="primary" size="sm" icon={<Save size={14} />}>Save Telegram Settings</Button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Globe size={18} className="text-brand-500" />
              <h3 className="text-base font-semibold text-ink-900">Storage (Cloudflare R2)</h3>
            </div>
            <div className="space-y-4">
              <Input label="R2 Account ID" placeholder="Your Cloudflare account ID" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Access Key ID" placeholder="..." />
                <Input label="Secret Access Key" type="password" placeholder="..." />
              </div>
              <Input label="Bucket Name" placeholder="uxlly-assets" />
              <Input label="Public URL" placeholder="https://assets.uxlly.com" />
              <Button variant="primary" size="sm" icon={<Save size={14} />}>Save Storage Settings</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}