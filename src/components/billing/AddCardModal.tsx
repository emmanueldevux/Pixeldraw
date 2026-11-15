"use client";
// "Add payment method" — Paystack saves a card the first time it is used, so adding a card means
// buying credits once by card. The card is then kept for one-click top-ups, plans and auto-reload.
import { useState } from "react";
import { Shell, btnPrimary, btnSecondary } from "./Shell";
import { centsToMilli, formatCredits, usd } from "@/lib/billing/units";
import type { BillingOverview } from "./types";

export function AddCardModal({ overview, onClose }: { overview: BillingOverview; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = overview.settings.topupMinCents;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents, paymentMethodId: "new" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Add payment method"
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={btnPrimary} onClick={go} disabled={busy}>{busy ? "Opening Paystack…" : `Add ${usd(cents)} credits and save my card`}</button>
        </>
      }
    >
      <p className="text-sm text-gray-600">
        Your card is saved securely by Paystack the first time you pay with it. Make a small credit purchase ({formatCredits(centsToMilli(cents, overview.settings.creditValueCents))} credits) and pay by card; it will be kept for one-click top-ups, plans and auto-reload.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Shell>
  );
}
