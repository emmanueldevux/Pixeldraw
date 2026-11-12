"use client";
import { Coins } from "lucide-react";
import { useBilling } from "./BillingProvider";
import { formatCredits } from "@/lib/billing/units";

/** Small "💰 120 credits" button. Click = open the Add credits popup. */
export function CreditsPill({ className = "" }: { className?: string }) {
  const { overview, openTopUp } = useBilling();
  if (!overview) return null;
  const freeLeft = overview.free.available ? Math.max(0, overview.free.cap - overview.free.usedTotal) : 0;
  return (
    <button
      type="button"
      onClick={() => openTopUp()}
      className={`flex items-center gap-2 h-9 pl-3 pr-3.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-900 transition-colors ${className}`}
      title="Add credits"
    >
      <Coins size={15} className="text-gray-500" />
      <span>{formatCredits(Math.max(0, overview.balanceMilli))}</span>
      <span className="font-medium text-gray-500">credits</span>
      {freeLeft > 0 && (
        <span className="ml-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#A3F76B] text-gray-900">{freeLeft} free</span>
      )}
    </button>
  );
}
