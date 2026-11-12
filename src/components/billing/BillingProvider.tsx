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

type Modal = { kind: "topup"; options: TopUpOptions } | { kind: "plans" } | { kind: "autoreload" } | { kind: "notready" } | null;

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

  useEffect(() => {
    if (authed) refresh();
    else setOverview(null);
  }, [authed, refresh]);

  const guard = (open: () => void) => {
    if (!authed) return openLogin();
    if (overview && !overview.stripeReady) return setModal({ kind: "notready" });
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

      {overview?.publishableKey && addCard && (
        <div className="relative z-[90]">
          <AddCardModal
            publishableKey={overview.publishableKey}
            onClose={() => setAddCard(false)}
            onSaved={async () => {
              setAddCard(false);
              await refresh();
            }}
          />
        </div>
      )}
    </BillingContext.Provider>
  );
}
