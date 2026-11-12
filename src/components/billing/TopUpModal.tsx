"use client";
// "Add to credit balance" -> "Confirm payment" -> done. Same flow as OpenAI's billing popups.
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Shell, btnPrimary, btnSecondary, inputCls, CardLabel } from "./Shell";
import { getStripeJs } from "./stripeClient";
import { centsToMilli, formatCredits, usd } from "@/lib/billing/units";
import type { BillingOverview, TopUpOptions } from "./types";

type Step = "amount" | "confirm" | "done";

export function TopUpModal({
  overview,
  options,
  onClose,
  onAddCard,
  onDone,
}: {
  overview: BillingOverview;
  options: TopUpOptions;
  onClose: () => void;
  onAddCard: () => void;
  onDone: () => void;
}) {
  const s = overview.settings;
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<string>(
    options.amountCents ? String(options.amountCents / 100) : String(Math.max(10, s.topupMinCents / 100)),
  );
  const [cardId, setCardId] = useState<string>(overview.cards.find((c) => c.isDefault)?.id || overview.cards[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idem] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())));

  const cents = Math.round(Number(amount) * 100);
  const valid = Number.isFinite(cents) && cents >= s.topupMinCents && cents <= s.topupMaxCents;
  const creditsMilli = valid ? centsToMilli(cents, s.creditValueCents) : 0;
  const card = overview.cards.find((c) => c.id === cardId) || overview.cards[0];
  const hasCard = overview.cards.length > 0;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents, paymentMethodId: card?.id, idempotencyKey: idem }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");

      if (data.status === "requires_action") {
        const stripe = await getStripeJs(overview.publishableKey!);
        const result = await stripe!.handleNextAction({ clientSecret: data.clientSecret });
        if (result.error) throw new Error(result.error.message || "Authentication failed");
        await fetch("/api/billing/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: data.paymentIntentId }),
        });
      }
      setStep("done");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <Shell title="Payment successful" onClose={onClose} footer={<button className={btnPrimary} onClick={onClose}>Done</button>}>
        <div className="flex flex-col items-center text-center py-4">
          <CheckCircle2 className="text-emerald-500 mb-3" size={44} />
          <p className="text-gray-900 font-semibold">{formatCredits(creditsMilli)} credits added</p>
          <p className="mt-1 text-sm text-gray-500">You can keep creating right away.</p>
        </div>
      </Shell>
    );
  }

  if (step === "confirm") {
    return (
      <Shell
        title="Confirm payment"
        onClose={onClose}
        onBack={() => setStep("amount")}
        footer={
          <>
            <button className={btnSecondary} onClick={() => setStep("amount")} disabled={busy}>Back</button>
            <button className={btnPrimary} onClick={pay} disabled={busy}>{busy ? "Processing…" : "Confirm payment"}</button>
          </>
        }
      >
        <div className="text-sm">
          <div className="flex justify-between text-gray-500 pb-2 border-b border-gray-200">
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div className="flex justify-between py-3 border-b border-gray-200 text-gray-900">
            <span>UXLLY credits ({formatCredits(creditsMilli)})</span>
            <span className="font-medium">{usd(cents)}</span>
          </div>
          <div className="flex justify-between py-2 text-gray-900 font-semibold">
            <span>Total</span>
            <span>{usd(cents)}</span>
          </div>

          <p className="mt-3 font-semibold text-gray-900">Balance summary</p>
          <div className="mt-1 flex justify-between py-1 text-gray-900">
            <span>Your credit purchase</span>
            <span className="text-emerald-600 font-medium">+{formatCredits(creditsMilli)}</span>
          </div>
          <div className="flex justify-between py-1 text-gray-900">
            <span>Estimated balance after purchase</span>
            <span className="font-semibold">{formatCredits(Math.max(0, overview.balanceMilli) + creditsMilli)}</span>
          </div>

          <p className="mt-4 font-semibold text-gray-900">Payment method</p>
          {card && (
            <div className="mt-1 flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
              <div>
                <CardLabel brand={card.brand} last4={card.last4} />
                <p className="text-xs text-gray-500 mt-0.5">Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}</p>
              </div>
              {card.isDefault && <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">Default</span>}
            </div>
          )}

          <p className="mt-4 text-xs text-gray-500">
            By continuing you agree to our credit terms. Paid credits are non-refundable and expire {s.creditExpiryDays === 365 ? "one year" : `${s.creditExpiryDays} days`} from purchase date.
          </p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      title="Add to credit balance"
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          {hasCard ? (
            <button className={btnPrimary} disabled={!valid} onClick={() => setStep("confirm")}>Continue</button>
          ) : (
            <button className={btnPrimary} onClick={onAddCard}>Add payment method</button>
          )}
        </>
      }
    >
      {options.reason === "out_of_credits" && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-900">
          You&apos;re out of credits{options.neededMilli ? ` — this needs about ${formatCredits(options.neededMilli)}` : ""}. Top up to keep creating.
        </div>
      )}

      <label className="block text-sm font-semibold text-gray-900 mb-1.5">Amount to add</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className={`${inputCls} pl-7`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Enter an amount between {usd(s.topupMinCents)} and {usd(s.topupMaxCents)}</span>
        {valid && <span className="font-medium text-gray-700">= {formatCredits(creditsMilli)} credits</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {s.topupPresetsCents.map((c) => (
          <button
            key={c}
            onClick={() => setAmount(String(c / 100))}
            className={`px-3 h-8 rounded-full border text-xs font-semibold transition-colors ${
              cents === c ? "bg-[#2B2B2B] text-white border-[#2B2B2B]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {usd(c)}
          </button>
        ))}
      </div>

      <label className="block text-sm font-semibold text-gray-900 mt-5 mb-1.5">Payment method</label>
      {hasCard ? (
        <>
          <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={inputCls}>
            {overview.cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.brand.toUpperCase()} •••• {c.last4}
                {c.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
          <button onClick={onAddCard} className="mt-2 w-full text-right text-sm font-semibold text-gray-800 hover:underline">
            + Add payment method
          </button>
        </>
      ) : (
        <p className="text-sm text-gray-500">No card saved yet. Add one to continue.</p>
      )}
    </Shell>
  );
}
