"use client";
// "Add payment method" — Stripe's card form INSIDE our popup. Card numbers never touch our server.
import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Shell, btnPrimary, btnSecondary } from "./Shell";
import { getStripeJs } from "./stripeClient";

function CardForm({ onSaved, onCancel }: { onSaved: (paymentMethodId: string) => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: err, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (err || !setupIntent) {
      setError(err?.message || "Could not save the card");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/billing/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "attach", setupIntentId: setupIntent.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save the card");
      setBusy(false);
      return;
    }
    onSaved(data.paymentMethodId);
  }

  return (
    <>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className={btnSecondary} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className={btnPrimary} onClick={save} disabled={busy || !stripe}>
          {busy ? "Saving…" : "Save card"}
        </button>
      </div>
    </>
  );
}

export function AddCardModal({
  publishableKey,
  onClose,
  onSaved,
}: {
  publishableKey: string;
  onClose: () => void;
  onSaved: (paymentMethodId: string) => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/setup-intent", { method: "POST" })
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => (ok ? setClientSecret(data.clientSecret) : setError(data.error || "Could not start")))
      .catch(() => setError("Could not reach the server"));
  }, []);

  return (
    <Shell title="Add payment method" onClose={onClose}>
      {error ? (
        <>
          <p className="text-sm text-red-600">{error}</p>
          <div className="mt-4 flex justify-end">
            <button className={btnSecondary} onClick={onClose}>Close</button>
          </div>
        </>
      ) : !clientSecret ? (
        <div className="py-10 flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
        </div>
      ) : (
        <Elements stripe={getStripeJs(publishableKey)} options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <CardForm onSaved={onSaved} onCancel={onClose} />
        </Elements>
      )}
    </Shell>
  );
}
