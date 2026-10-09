import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

/** Homepage entry to the KTMONA Price Lock collection. */
export function PriceLockBand() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-6 xl:px-8">
      <Link
        href="/price-lock"
        className="group flex flex-col gap-4 overflow-hidden rounded-2xl bg-ink p-6 text-paper sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div className="flex items-center gap-4">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-ink">
            <Lock className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">KTMONA Price Lock</p>
            <p className="mt-1 text-xl font-semibold sm:text-2xl">The lowest price in the market, locked in.</p>
            <p className="mt-1 text-sm text-paper/75">Products our sellers offer at their best price anywhere, checked by the KTMONA team.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-ink transition-transform group-hover:translate-x-1 sm:self-auto">
          Shop Price Lock <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>
    </section>
  );
}
