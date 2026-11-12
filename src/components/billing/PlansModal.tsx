"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Shell, btnPrimary, btnSecondary } from "./Shell";
import { getStripeJs } from "./stripeClient";
import { formatCredits, usd } from "@/lib/billing/units";
import type { BillingOverview } from "./types";

export function PlansModal({
  overview,
  onClose,
  onAddCard,
  onTopUp,
  onDone,
}: {
  overview: BillingOverview;
  onClose: () => void;
  onAddCard: () => void;
  onTopUp: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const best = overview.plans.reduce((m, p) => Math.max(m, p.creditsMilli / p.priceCents), 0);

  async function choose(planKey: string) {
    if (overview.cards.length === 0) return onAddCard();
    setBusy(planKey);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start plan");
      if (data.status === "requires_action") {
        const stripe = await getStripeJs(overview.publishableKey!);
        const r = await stripe!.handleNextAction({ clientSecret: data.clientSecret });
        if (r.error) throw new Error(r.error.message || "Authentication failed");
        await fetch("/api/billing/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId: data.subscriptionId }),
        });
      }
      setDone(true);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <Shell title="You're on a plan" onClose={onClose} footer={<button className={btnPrimary} onClick={onClose}>Done</button>}>
        <p className="text-sm text-gray-600">Your monthly credits have been added. Enjoy creating!</p>
      </Shell>
    );
  }

  return (
    <Shell
      title="Choose a plan"
      width="max-w-2xl"
      onClose={onClose}
      footer={<button className={btnSecondary} onClick={onTopUp}>Or just pay as you go</button>}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        {overview.plans.map((p) => {
          const current = overview.plan?.key === p.key;
          const bonus = p.creditsMilli / p.priceCents >= best && overview.plans.length > 1;
          const perCredit = p.priceCents / (p.creditsMilli / 1000);
          return (
            <div key={p.key} className={`rounded-xl border p-5 ${bonus ? "border-gray-900" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-gray-900">{p.name}</h4>
                {bonus && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#A3F76B] text-gray-900">Best value</span>}
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {usd(p.priceCents)}
                <span className="text-sm font-medium text-gray-500">/month</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                <li className="flex gap-2"><Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />{formatCredits(p.creditsMilli)} credits every month</li>
                <li className="flex gap-2"><Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />{usd(Math.round(perCredit))} per credit</li>
                <li className="flex gap-2"><Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />Cancel anytime</li>
              </ul>
              <button className={`${btnPrimary} w-full mt-4`} disabled={current || !!busy} onClick={() => choose(p.key)}>
                {current ? "Current plan" : busy === p.key ? "Starting…" : overview.cards.length === 0 ? "Add card to start" : `Start ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
      {overview.plan && <p className="mt-3 text-xs text-gray-500">To switch plans, cancel your current one first — it stays active until the end of the period.</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Shell>
  );
}
