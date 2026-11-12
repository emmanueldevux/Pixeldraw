"use client";
import { useState } from "react";
import { Shell, btnPrimary, btnSecondary, inputCls } from "./Shell";
import { centsToMilli, formatCredits, fromMilli, usd } from "@/lib/billing/units";
import type { BillingOverview } from "./types";

export function AutoReloadModal({
  overview,
  onClose,
  onAddCard,
  onSaved,
}: {
  overview: BillingOverview;
  onClose: () => void;
  onAddCard: () => void;
  onSaved: () => void;
}) {
  const s = overview.settings;
  const ar = overview.autoReload;
  const [below, setBelow] = useState(String(ar.enabled ? fromMilli(ar.belowMilli) : 20));
  const [amount, setAmount] = useState(String(ar.enabled ? ar.amountCents / 100 : 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = Math.round(Number(amount) * 100);
  const valid = cents >= s.autoReloadMinCents && cents <= s.autoReloadMaxCents && Number(below) >= 0 && below !== "";

  async function save(enabled: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/auto-reload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, belowCredits: Number(below), amountCents: cents }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not save");
    onSaved();
    onClose();
  }

  if (overview.cards.length === 0) {
    return (
      <Shell title="Enable auto-reload" onClose={onClose} footer={<><button className={btnSecondary} onClick={onClose}>Cancel</button><button className={btnPrimary} onClick={onAddCard}>Add payment method</button></>}>
        <p className="text-sm text-gray-600">Auto-reload charges your saved card when credits run low. Add a payment method first.</p>
      </Shell>
    );
  }

  return (
    <Shell
      title={ar.enabled ? "Edit auto-reload" : "Enable auto-reload"}
      onClose={onClose}
      footer={
        <>
          {ar.enabled && <button className={btnSecondary} onClick={() => save(false)} disabled={busy}>Turn off</button>}
          <button className={btnPrimary} onClick={() => save(true)} disabled={busy || !valid}>{busy ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <p className="text-sm text-gray-600 mb-4">
        Keep creating without interruptions. When your balance gets low we charge your default card automatically. If it&apos;s off, you&apos;ll simply be asked to top up when credits run out.
      </p>
      <label className="block text-sm font-semibold text-gray-900 mb-1.5">When credits go below</label>
      <input inputMode="decimal" value={below} onChange={(e) => setBelow(e.target.value.replace(/[^0-9.]/g, ""))} className={inputCls} />
      <label className="block text-sm font-semibold text-gray-900 mt-4 mb-1.5">Reload with</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputCls} pl-7`} />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {usd(s.autoReloadMinCents)}–{usd(s.autoReloadMaxCents)} · adds {valid ? formatCredits(centsToMilli(cents, s.creditValueCents)) : "—"} credits each time
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Shell>
  );
}
