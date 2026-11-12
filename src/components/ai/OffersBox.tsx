// ============================================================
// UXLLY — Offers box (Project settings)
// The only part of the brand brain users edit: real offers (discounts,
// free delivery, guarantees). Designs only ever mention these, exactly
// as written; with none saved, no design shows a discount.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import type { BrainOffer } from "@/lib/brain/types";

const input = "w-full h-9 rounded-lg border border-[#E3E3E6] bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900";

export default function OffersBox({ brandId }: { brandId: string }) {
  const [offers, setOffers] = useState<BrainOffer[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", code: "", details: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOffers(null);
    fetch(`/api/brain?brandId=${encodeURIComponent(brandId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setOffers(d.data?.offers ?? []))
      .catch(() => setOffers([]));
  }, [brandId]);

  async function save(next: BrainOffer[]) {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/brain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, section: "offers", value: next }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save");
      setOffers(d.data.offers);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function add() {
    if (!draft.title.trim() || !offers) return;
    const nextId = `O${offers.reduce((m, o) => Math.max(m, Number(o.id.slice(1)) || 0), 0) + 1}`;
    if (await save([...offers, { id: nextId, title: draft.title.trim(), code: draft.code.trim(), details: draft.details.trim(), isGuarantee: false }])) {
      setDraft({ title: "", code: "", details: "" });
      setAdding(false);
    }
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-[#E3E3E6] p-3.5">
      <div className="flex items-center gap-2">
        <Tag size={15} className="text-zinc-700" />
        <p className="text-sm font-semibold text-zinc-900 flex-1">Offers</p>
        {saving && <Loader2 size={14} className="animate-spin text-zinc-400" />}
      </div>
      <p className="mt-1 text-xs text-zinc-500">Designs only mention these offers, exactly as written. No offers saved = no discounts shown.</p>

      {offers === null ? (
        <div className="py-3 flex justify-center"><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
      ) : (
        <>
          {offers.length > 0 && (
            <ul className="mt-3 space-y-2">
              {offers.map((o) => (
                <li key={o.id} className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {o.title}
                      {o.code && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-white border border-[#E3E3E6] text-[11px] font-mono">{o.code}</span>}
                    </p>
                    {o.details && <p className="text-xs text-zinc-500">{o.details}</p>}
                  </div>
                  <button onClick={() => save(offers.filter((x) => x.id !== o.id))} disabled={saving} className="p-1 rounded text-zinc-400 hover:text-zinc-900" aria-label="Remove offer">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <div className="mt-3 space-y-2">
              <input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. 20% off your first order" autoFocus />
              <div className="flex gap-2">
                <input className={input} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Code (optional)" />
                <input className={input} value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} placeholder="Terms (optional)" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAdding(false)} className="h-8 px-3 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100">Cancel</button>
                <button onClick={add} disabled={saving || !draft.title.trim()} className="h-8 px-3 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50">Save offer</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 hover:text-zinc-900">
              <Plus size={14} /> Add an offer
            </button>
          )}
          {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        </>
      )}
    </div>
  );
}
