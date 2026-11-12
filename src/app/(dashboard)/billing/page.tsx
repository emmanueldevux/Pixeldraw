// ============================================================
// UXLLY — Billing (/billing)
// OpenAI-style: balance, plan, auto-reload, buy credits, cards, history, pricing.
// ============================================================
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Crown, Zap, Rocket, ShieldCheck, XCircle, CheckCircle2, Plus, Check } from "lucide-react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { getStripeJs } from "@/components/billing/stripeClient";
import { useBilling } from "@/components/billing/BillingProvider";
import { useAuthGate } from "@/components/auth/AuthGate";
import { CardLabel } from "@/components/billing/Shell";
import { formatCredits, fromMilli, milliToCents, usd } from "@/lib/billing/units";

type Tab = "overview" | "plans" | "cards" | "history";

interface HistoryRow {
  id: string;
  deltaMilli: number;
  kind: string;
  note: string | null;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  purchase: "Credit purchase",
  autoreload: "Auto-reload",
  plan: "Plan credits",
  admin: "Credits from support",
  usage: "Used",
  free: "Free trial image",
  note: "Note",
};

const btn = "h-10 px-5 rounded-lg text-sm font-semibold transition-colors";
const btnDark = `${btn} bg-[#2B2B2B] hover:bg-black text-white`;
const btnLight = `${btn} bg-white border border-gray-300 hover:bg-gray-50 text-gray-800`;

// Header band per plan card (CSS-only artwork, no image assets needed).
const PLAN_ART: Record<string, { icon: typeof Crown; tagline: string; bg: string }> = {
  payg: { icon: Zap, tagline: "No commitment", bg: "radial-gradient(120% 120% at 85% 10%, #3B5BDB 0%, #1E2A78 35%, #0B1033 75%)" },
  starter: { icon: Rocket, tagline: "For getting started", bg: "radial-gradient(120% 120% at 80% 0%, #4C6EF5 0%, #233CC2 40%, #0C1447 80%)" },
  pro: { icon: Crown, tagline: "Best value", bg: "radial-gradient(130% 130% at 75% 15%, #74C0FC 0%, #2F6BFF 30%, #1631A8 60%, #0A0F3A 90%)" },
};
const blueBtn = "w-full h-10 rounded-full text-sm font-semibold text-white bg-[#2F6BFF] hover:bg-[#1F5AF0] disabled:opacity-60 transition-colors";

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardHeader title="Billing" subtitle="Credits, plans and payments" onMenuClick={() => {}} />
      <div className="uxlly-content !max-w-none">{children}</div>
    </>
  );
}

function BillingInner() {
  const { status } = useSession();
  const { openLogin } = useAuthGate();
  const { overview, refresh, openTopUp, openAutoReload, openAddCard } = useBilling();
  const qs = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = qs?.get("tab");
    return t === "plans" || t === "cards" || t === "history" ? t : "overview";
  });
  useEffect(() => {
    const t = qs?.get("tab");
    if (t === "plans" || t === "cards" || t === "history") setTab(t);
  }, [qs]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/billing/history", { cache: "no-store" });
    if (res.ok) setHistory((await res.json()).events);
  }, []);

  useEffect(() => {
    if (tab === "history" && status === "authenticated") loadHistory();
  }, [tab, status, loadHistory]);

  if (status === "unauthenticated") {
    return (
      <Wrap>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <p className="text-sm text-gray-500">Sign in to manage your credits and plan.</p>
          <button className={btnDark} onClick={openLogin}>Sign in</button>
        </div>
      </Wrap>
    );
  }

  if (!overview) {
    return (
      <Wrap>
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
        </div>
      </Wrap>
    );
  }

  const s = overview.settings;
  const plan = overview.plan;
  const ar = overview.autoReload;
  const balance = Math.max(0, overview.balanceMilli);
  const dateFmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "");

  async function api(url: string, init: RequestInit, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMsg(ok);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function choosePlan(planKey: string) {
    if (!overview) return;
    if (overview.cards.length === 0) return openAddCard();
    setBusy(true);
    setMsg(null);
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
      setMsg("You're on a plan. Your monthly credits have been added.");
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "plans", label: "See plans" },
    { id: "cards", label: "Payment methods" },
    { id: "history", label: "Billing history" },
  ];

  const customCents = Math.round((Number(custom) || 0) * 100);
  function buyCustom() {
    if (customCents && (customCents < s.topupMinCents || customCents > s.topupMaxCents)) {
      setMsg(`Enter an amount between ${usd(s.topupMinCents)} and ${usd(s.topupMaxCents)}.`);
      return;
    }
    setMsg(null);
    openTopUp(customCents ? { amountCents: customCents } : undefined);
  }

  const bestRate = overview.plans.reduce((m, p) => Math.max(m, p.creditsMilli / p.priceCents), 0);
  const planCards = [
    {
      key: "payg",
      name: "Custom",
      price: "",
      suffix: "",
      features: [
        `Buy credits from ${usd(s.topupMinCents)} to ${usd(s.topupMaxCents)}`,
        `1 credit = ${usd(s.creditValueCents)}`,
        "Optional auto-reload",
        `Credits last ${s.creditExpiryDays === 365 ? "1 year" : `${s.creditExpiryDays} days`}`,
      ],
      cta: "Buy →",
      current: false,
      onClick: () => buyCustom(),
    },
    ...overview.plans.map((p) => {
      const current = plan?.key === p.key;
      const extra = Math.round(fromMilli(p.creditsMilli) - p.priceCents / s.creditValueCents);
      return {
        key: p.key,
        name: p.name,
        price: usd(p.priceCents),
        suffix: "/mo",
        features: [
          `${formatCredits(p.creditsMilli)} credits every month`,
          extra > 0 ? `${extra} bonus credits included` : "Credits at the standard rate",
          "All AI tools and models",
          "Cancel anytime",
        ],
        cta: current ? "Current plan" : plan ? "Cancel current plan to switch" : overview.cards.length === 0 ? `Add card to get ${p.name}` : `Get ${p.name}`,
        current,
        disabled: current || !!plan || busy,
        best: overview.plans.length > 1 && p.creditsMilli / p.priceCents >= bestRate,
        onClick: () => choosePlan(p.key),
      };
    }),
  ];

  const planGrid = (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              {planCards.map((c) => {
                const art = PLAN_ART[c.key] ?? PLAN_ART.starter;
                const Icon = art.icon;
                return (
                  <div key={c.key} className={`rounded-2xl bg-white overflow-hidden flex flex-col shadow-sm border ${"best" in c && c.best ? "border-[#2F6BFF]" : "border-gray-200"}`}>
                    <div className="relative h-44 p-5 text-white flex flex-col justify-between" style={{ background: art.bg }}>
                      <div className="flex items-start justify-between">
                        <span className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center"><Icon size={18} /></span>
                        {c.current && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white text-gray-900">Current</span>}
                        {!c.current && "best" in c && c.best && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#A3F76B] text-gray-900">Best value</span>}
                      </div>
                      {c.key === "payg" ? (
                        <div>
                          <p className="text-sm font-semibold text-white/90 uppercase tracking-wider">{c.name}</p>
                          <label className="mt-1 flex items-center gap-1 rounded-lg bg-white/10 border border-white/25 px-3 h-11 focus-within:border-white/60">
                            <span className="text-2xl font-bold">$</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={s.topupMinCents / 100}
                              max={s.topupMaxCents / 100}
                              value={custom}
                              onChange={(e) => setCustom(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && buyCustom()}
                              placeholder={String(s.topupMinCents / 100)}
                              className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-white/40 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </label>
                          <p className="mt-1 text-xs text-white/80">
                            {customCents > 0 ? `= ${formatCredits(Math.floor((customCents / s.creditValueCents) * 1000))} credits` : "Enter any amount"} · {usd(s.topupMinCents)} minimum
                          </p>
                        </div>
                      ) : (
                      <div>
                        <p className="text-sm font-semibold text-white/90">{c.name}</p>
                        <p className="text-3xl font-bold leading-tight">{c.price}<span className="text-base font-medium text-white/100">{c.suffix}</span></p>
                        <p className="text-xs text-white/70">{art.tagline}</p>
                      </div>
                      )}
                    </div>
                    <ul className="p-5 space-y-2.5 text-sm text-gray-700 flex-1">
                      {c.features.map((f) => (
                        <li key={f} className="flex gap-2.5">
                          <span className="w-4 h-4 mt-0.5 rounded-full bg-[#2F6BFF] text-white flex items-center justify-center shrink-0"><Check size={11} strokeWidth={3} /></span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="px-5 pb-5">
                      <button className={blueBtn} disabled={"disabled" in c ? c.disabled : false} onClick={c.onClick}>{c.cta}</button>
                    </div>
                  </div>
                );
              })}
            </div>
  );

  return (
    <Wrap>
      <div className="w-full">
        <div className="flex gap-6 border-b border-gray-200 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {msg && <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800">{msg}</div>}

        {tab === "overview" && (
          <div className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Credits</h2>
                <p className="text-5xl font-bold text-gray-900 tracking-tight">{formatCredits(balance)}</p>
              </div>
              <button className={`${btnDark} inline-flex items-center gap-1.5`} onClick={() => openTopUp()}>
                <Plus size={16} /> Top up credits
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              ≈ {usd(milliToCents(balance, s.creditValueCents))} of creating
              {overview.nextExpiry ? ` · next credits expire ${dateFmt(overview.nextExpiry)}` : ""}
            </p>
            {overview.free.available && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#A3F76B]/60 text-gray-900">
                Free trial: {Math.max(0, overview.free.cap - overview.free.usedTotal)} free image(s) left
              </p>
            )}

            {/* Auto-reload */}
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex gap-3 flex-1">
                {ar.enabled ? <CheckCircle2 className="text-emerald-500 mt-0.5 shrink-0" size={20} /> : <XCircle className="text-gray-400 mt-0.5 shrink-0" size={20} />}
                <div>
                  <p className="font-semibold text-gray-900">
                    Auto-reload is{" "}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${ar.enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {ar.enabled ? "ON" : "OFF"}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {ar.enabled
                      ? `When credits go below ${formatCredits(ar.belowMilli)}, we add ${usd(ar.amountCents)} to your balance.`
                      : "When your credits run out, you'll be asked to top up. Enable auto-reload to keep your balance topped up automatically."}
                  </p>
                </div>
              </div>
              <button className={btnLight} onClick={openAutoReload}>{ar.enabled ? "Edit auto-reload" : "Enable auto-reload"}</button>
            </div>

            {/* Plan (only shown when subscribed) */}
            {plan && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{plan ? `${plan.name} plan — ${usd(plan.priceCents)}/month` : "No monthly plan"}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {plan
                    ? plan.cancelAtPeriodEnd
                      ? `Cancels on ${dateFmt(plan.currentPeriodEnd)}. You keep your credits.`
                      : `${formatCredits(plan.creditsMilli)} credits each month · renews ${dateFmt(plan.currentPeriodEnd)}${plan.status === "past_due" ? " · payment failed, update your card" : ""}`
                    : "Pick Starter or Pro for monthly credits at a better rate, or just pay as you go."}
                </p>
              </div>
              {plan ? (
                plan.cancelAtPeriodEnd ? (
                  <button className={btnLight} disabled={busy} onClick={() => api("/api/billing/subscription", { method: "PATCH" }, "Plan resumed.")}>Resume plan</button>
                ) : (
                  <button
                    className={btnLight}
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Cancel your plan? It stays active until the end of the current period and you keep your credits.")) {
                        api("/api/billing/subscription", { method: "DELETE" }, "Your plan will cancel at the end of the period.");
                      }
                    }}
                  >
                    Cancel plan
                  </button>
                )
              ) : null}
            </div>
            )}

            {/* Plans */}
            <div className="mt-10 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Plans</h2>
                <p className="mt-1 text-sm text-gray-500">Pay as you go, or pick a monthly plan for bonus credits. All credits go into one balance.</p>
              </div>
              {overview.isAdmin && (
                <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900">
                  <ShieldCheck size={16} /> Admin
                </Link>
              )}
            </div>
            {planGrid}
          </div>
        )}

        {tab === "cards" && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Payment methods</h2>
              <button className={btnDark} onClick={openAddCard}>Add payment method</button>
            </div>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
              {overview.cards.length === 0 && <p className="p-5 text-sm text-gray-500">No cards saved yet.</p>}
              {overview.cards.map((c) => (
                <div key={c.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1">
                    <CardLabel brand={c.brand} last4={c.last4} />
                    <p className="text-xs text-gray-500 mt-0.5">Expires {String(c.expMonth).padStart(2, "0")}/{c.expYear}</p>
                  </div>
                  {c.isDefault ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">Default</span>
                  ) : (
                    <button
                      className="text-sm font-semibold text-gray-800 hover:underline"
                      disabled={busy}
                      onClick={() =>
                        api("/api/billing/payment-methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "default", paymentMethodId: c.id }) }, "Default card updated.")
                      }
                    >
                      Make default
                    </button>
                  )}
                  <button
                    className="text-sm font-semibold text-red-600 hover:underline"
                    disabled={busy}
                    onClick={() => confirm("Remove this card?") && api(`/api/billing/payment-methods?id=${c.id}`, { method: "DELETE" }, "Card removed.")}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Billing history</h2>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium text-right">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">Nothing yet.</td></tr>
                  )}
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{new Date(h.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                      <td className="px-4 py-2.5 text-gray-900">{h.kind === "usage" ? "Used" : h.note || KIND_LABEL[h.kind] || h.kind}{h.kind === "usage" && h.note ? ` — ${h.note}` : ""}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${h.deltaMilli > 0 ? "text-emerald-600" : h.deltaMilli < 0 ? "text-gray-900" : "text-gray-400"}`}>
                        {h.deltaMilli > 0 ? "+" : ""}{h.deltaMilli === 0 ? "—" : formatCredits(h.deltaMilli)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "plans" && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Plans</h2>
            <p className="mt-1 text-sm text-gray-500">Pay as you go, or pick a monthly plan for bonus credits. All credits go into one balance.</p>
            {planGrid}
            {plan && <p className="mt-3 text-xs text-gray-500">To switch plans, cancel your current one on the Overview tab first. It stays active until the end of the period.</p>}

            <h3 className="mt-10 text-base font-semibold text-gray-900">What each action costs</h3>
            <p className="mt-1 text-sm text-gray-500">1 credit = {usd(s.creditValueCents)}. Each action is charged by what it actually takes to make, so these are typical amounts. Failed generations cost nothing.</p>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 font-medium">Action</th>
                    <th className="px-4 py-2.5 font-medium text-right">Credits</th>
                    <th className="px-4 py-2.5 font-medium text-right">≈ USD</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.pricing.map((p) => (
                    <tr key={p.key} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2.5 text-gray-900">{p.label}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatCredits(p.creditsMilli)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">${(fromMilli(p.creditsMilli) * s.creditValueCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">Purchased and plan credits expire {s.creditExpiryDays === 365 ? "one year" : `${s.creditExpiryDays} days`} after they are added. Paid credits are non-refundable.</p>
          </div>
        )}
      </div>
    </Wrap>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingInner />
    </Suspense>
  );
}
