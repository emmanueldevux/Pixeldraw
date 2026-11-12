"use client";
// Loads Stripe.js once per publishable key. Needs: npm i @stripe/stripe-js @stripe/react-stripe-js
import { loadStripe, type Stripe } from "@stripe/stripe-js";

let cached: { key: string; promise: Promise<Stripe | null> } | null = null;

export function getStripeJs(publishableKey: string) {
  if (!cached || cached.key !== publishableKey) {
    cached = { key: publishableKey, promise: loadStripe(publishableKey) };
  }
  return cached.promise;
}
