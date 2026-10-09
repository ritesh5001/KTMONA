"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { RtoRates } from "@/services/seller-supplier";

function Rate({ value, tone }: { value: number; tone: "bad" | "good" }) {
  return (
    <span
      className={
        tone === "bad"
          ? "rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-red-700 dark:text-red-300"
          : "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
      }
    >
      {value}%
    </span>
  );
}

/** "Reduce RTO & Returns" card (Home and Pricing), linking to the discount page. */
export function RtoCard({ rates, compact }: { rates: RtoRates | undefined; compact?: boolean }) {
  return (
    <section className="rounded-2xl border border-border-soft bg-card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ShieldCheck className="h-5 w-5 text-emerald-600" /> Reduce RTO &amp; Returns
      </h2>
      <div className={compact ? "mt-4 space-y-4" : "mt-4 grid gap-4 sm:grid-cols-2"}>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Reduce RTO <Rate value={rates?.codRto ?? 0} tone="bad" />
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Rate value={rates?.prepaidRto ?? 0} tone="good" />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Add Prepaid Discount (COD order → Prepaid)</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Reduce Returns <Rate value={rates?.allReturns ?? 0} tone="bad" />
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Rate value={rates?.wdrpReturns ?? 0} tone="good" />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Add WDRP Discount (Unwanted → Genuine Returns)</p>
        </div>
      </div>
      <Link
        href="/seller/pricing/reduce-rto"
        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-ink text-sm font-semibold text-paper transition-colors hover:bg-navy dark:bg-brand dark:text-ink"
      >
        Reduce RTO &amp; Returns
      </Link>
    </section>
  );
}
