"use client";

import useSWR from "swr";
import { sellerCenter } from "@/services/seller-center";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

/** Commission terms, fetched once and shared by every price field. */
export function useCommissionTerms() {
  const { data } = useSWR("seller-commission-terms", () => sellerCenter.calculator(100), {
    revalidateOnFocus: false,
    dedupingInterval: 10 * 60_000,
  });
  return data ? { commissionPct: data.commissionPct, platformFee: data.platformFee } : null;
}

/** "You will earn ₹X" preview shown under a seller-price input. */
export function EarningsHint({ price }: { price: string | number | null | undefined }) {
  const terms = useCommissionTerms();
  const value = Number(price);
  if (!terms || !Number.isFinite(value) || value <= 0) return null;
  const commission = Math.round(value * terms.commissionPct) / 100;
  const net = Math.max(0, value - commission - terms.platformFee);
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      You will earn <span className="font-semibold text-emerald-700 dark:text-emerald-400">{inr.format(net)}</span>
      <span> after {terms.commissionPct}% commission{terms.platformFee ? ` + ${inr.format(terms.platformFee)} fee` : ""}</span>
    </p>
  );
}
