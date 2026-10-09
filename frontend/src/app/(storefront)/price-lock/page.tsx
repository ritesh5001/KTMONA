import type { Metadata } from "next";
import { BadgeCheck, Lock, TrendingDown } from "lucide-react";
import { ProductFeed } from "@/components/storefront/ProductFeed";

export const metadata: Metadata = {
  title: "KTMONA Price Lock | Lowest prices, verified",
  description: "Products KTMONA sellers offer at the lowest price in the market, checked by the KTMONA team.",
};

const POINTS = [
  { icon: TrendingDown, text: "Sellers promise their lowest market price" },
  { icon: BadgeCheck, text: "Every product checked by the KTMONA team" },
  { icon: Lock, text: "Badge removed automatically if the price goes up" },
];

export default function PriceLockPage() {
  return (
    <div className="bg-background">
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-[1440px] px-4 py-10 xl:px-8">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-brand">
            <Lock className="h-4 w-4" aria-hidden /> KTMONA Price Lock
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold sm:text-4xl">The lowest price in the market, locked in.</h1>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper/85">
            {POINTS.map((p) => (
              <li key={p.text} className="inline-flex items-center gap-2">
                <p.icon className="h-4 w-4 text-brand" aria-hidden /> {p.text}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <ProductFeed title={null} priceLock />
    </div>
  );
}
