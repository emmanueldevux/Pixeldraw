"use client";
// ============================================================
// BillingProvider — one place that knows the user's credits and owns
// every billing popup, so ANY page can say `openTopUp()` (e.g. when an
// AI call returns 402 "out of credits").
// ============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useAuthGate } from "@/components/auth/AuthGate";
import { TopUpModal } from "./TopUpModal";
import { AddCardModal } from "./AddCardModal";
import { AutoReloadModal } from "./AutoReloadModal";
import { PlansModal } from "./PlansModal";
import { Shell, btnPrimary } from "./Shell";
import type { BillingOverview, TopUpOptions } from "./types";

interface Ctx {
  overview: BillingOverview | null;
  balanceMilli: number;
  refresh: () => Promise<void>;
  openTopUp: (options?: TopUpOptions) => void;
  openPlans: () => void;
  openAutoReload: () => void;
  openAddCard: () => void;
}

const noop = () => {};
const fallback: Ctx = {
  overview: null,
  balanceMilli: 0,
  refresh: async () => {},
  openTopUp: noop,
  openPlans: noop,
  openAutoReload: noop,
  openAddCard: noop,
};

const BillingContext = createContext<Ctx>(fallback);
export const useBilling = () => useContext(BillingContext);

type Modal = { kind: "topup"; options: TopUpOptions } | { kind: "plans" } | { kind: "autoreload" } | { kind: "notready" } | { kind: "paid"; ok: boolean } | null;

export function BillingProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { openLogin } = useAuthGate();
  const authed = status === "authenticated";
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [addCard, setAddCard] = useState(false);

  const refresh = useCallback(async () => {
    if (!authed) return;
    try {
      const res = await fetch("/api/billing/overview", { cache: "no-store" });
      if (res.ok) setOverview(await res.json());
    } catch {
      /* ignore */
    }
  }, [authed]);

  // Back from Paystack checkout: confirm the payment (the webhook may be slower), then show the result.
  useEffect(() => {
    if (!authed) return;
    const q = new URLSearchParams(window.location.search);
    const ref = q.get("reference") || q.get("trxref");
    if (!ref) return;
    q.delete("reference");
    q.delete("trxref");
    q.delete("ps");
    const rest = q.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    fetch("/api/billing/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: ref }) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        setModal({ kind: "paid", ok: r.ok && d.status === "success" });
        refresh();
      })
      .catch(() => setModal({ kind: "paid", ok: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    if (authed) refresh();
    else setOverview(null);
  }, [authed, refresh]);

  const guard = (open: () => void) => {
    if (!authed) return openLogin();
    if (overview && !overview.paymentsReady) return setModal({ kind: "notready" });
    open();
  };

  const value = useMemo<Ctx>(
    () => ({
      overview,
      balanceMilli: overview?.balanceMilli ?? 0,
      refresh,
      openTopUp: (options = {}) => guard(() => setModal({ kind: "topup", options })),
      openPlans: () => guard(() => setModal({ kind: "plans" })),
      openAutoReload: () => guard(() => setModal({ kind: "autoreload" })),
      openAddCard: () => guard(() => setAddCard(true)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overview, refresh, authed]
  );

  const close = () => setModal(null);

  return (
    <BillingContext.Provider value={value}>
      {children}

      {overview && modal?.kind === "topup" && (
        <TopUpModal
          overview={overview}
          options={modal.options}
          onClose={close}
          onAddCard={() => setAddCard(true)}
          onDone={refresh}
        />
      )}
      {overview && modal?.kind === "plans" && (
        <PlansModal
          overview={overview}
          onClose={close}
          onAddCard={() => setAddCard(true)}
          onTopUp={() => setModal({ kind: "topup", options: {} })}
          onDone={refresh}
        />
      )}
      {overview && modal?.kind === "autoreload" && (
        <AutoReloadModal overview={overview} onClose={close} onAddCard={() => setAddCard(true)} onSaved={refresh} />
      )}
      {modal?.kind === "notready" && (
        <Shell title="Payments are almost ready" onClose={close} footer={<button className={btnPrimary} onClick={close}>OK</button>}>
          <p className="text-sm text-gray-600">Card payments are being set up. Please try again soon.</p>
        </Shell>
      )}

      {modal?.kind === "paid" && (
        <Shell title={modal.ok ? "Payment successful" : "Payment not completed"} onClose={close} footer={<button className={btnPrimary} onClick={close}>OK</button>}>
          <p className="text-sm text-gray-600">{modal.ok ? "Your credits have been added. You can keep creating right away." : "We could not confirm that payment. If you were charged, your credits will appear shortly."}</p>
        </Shell>
      )}

      {overview && addCard && (
        <div className="relative z-[90]">
          <AddCardModal overview={overview} onClose={() => setAddCard(false)} />
        </div>
      )}
    </BillingContext.Provider>
  );
}
