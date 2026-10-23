"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Gift, Percent, Sparkles, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { couponConditions, couponHeadline, getOffers, type OffersResponse } from "@/services/offers";

export default function OffersPage() {
  const [data, setData] = React.useState<OffersResponse | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    getOffers().then(setData).catch(() => setError(true));
  }, []);

  const copy = (code: string) =>
    navigator.clipboard?.writeText(code).then(() => toast.success(`${code} copied`)).catch(() => undefined);

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <header className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">Offers & rewards</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Today&apos;s offers</h1>
          <p className="text-sm text-muted-foreground">Coupons, sale events, cashback and referral rewards — with the terms that apply.</p>
        </header>

        {error ? <p className="text-sm text-muted-foreground">Couldn&apos;t load offers. Please try again.</p> : null}
        {!data && !error ? <div className="h-48 animate-pulse rounded-2xl bg-mist/60" aria-busy="true" /> : null}

        {data ? (
          <>
            {/* Headline rewards */}
            <div className="grid gap-4 md:grid-cols-3">
              {data.welcome ? (
                <RewardCard icon={Gift} title={`₹${data.welcome.amount} off your first order`}>
                  Applied automatically at checkout on a first order of ₹{data.welcome.minOrder} or more. No code needed.
                </RewardCard>
              ) : null}
              {data.cashback ? (
                <RewardCard icon={Wallet} title={`${data.cashback.percent}% cashback on every order`}>
                  Added to your wallet {data.cashback.holdDays} days after delivery (once the return window closes). Use it for up to {data.cashback.maxUsePercent}% of an order within {data.cashback.expiryDays} days.
                </RewardCard>
              ) : null}
              {data.referral ? (
                <RewardCard icon={Users} title={`Refer & earn ₹${data.referral.referrerAmount}`}>
                  Your friend gets ₹{data.referral.friendAmount} off their first order (₹{data.referral.minOrder}+). You get ₹{data.referral.referrerAmount} cashback when it&apos;s delivered.{" "}
                  <Link href="/user/referrals" className="font-medium text-brand-strong hover:underline">Get your link</Link>
                </RewardCard>
              ) : null}
            </div>

            {/* Sale events */}
            {data.sales.length ? (
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-brand-strong" /> Sale events</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.sales.map((s) => (
                    <Link key={s.id} href={`/sale/${s.slug}`} className="rounded-2xl border border-border-soft bg-card p-4 hover:border-brand/40">
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand-strong">{s.live ? "Live now" : "Coming soon"}</p>
                      <p className="mt-1 font-semibold">{s.name}</p>
                      {s.description ? <p className="text-sm text-muted-foreground">{s.description}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        At least {s.minDiscountPercent}% off · {s.live ? "Ends" : "Starts"}{" "}
                        {new Date(s.live ? s.endsAt : s.startsAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Coupons */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Percent className="h-5 w-5 text-brand-strong" /> Coupons</h2>
              {data.coupons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No coupons right now. Check back during sale events.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.coupons.map((c) => (
                    <article key={c.code} className="flex flex-col gap-3 rounded-2xl border border-dashed border-brand/40 bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{couponHeadline(c)}</p>
                          {c.title ? <p className="text-sm text-muted-foreground">{c.title}</p> : null}
                        </div>
                        {c.autoApply ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">Auto-applied</span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => copy(c.code)}>
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> {c.code}
                          </Button>
                        )}
                      </div>
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {couponConditions(c).map((line) => <li key={line}>• {line}</li>)}
                      </ul>
                      {c.terms ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium text-foreground">Terms & conditions</summary>
                          <p className="mt-1 whitespace-pre-line text-muted-foreground">{c.terms}</p>
                        </details>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* General terms */}
            <section className="space-y-2 rounded-2xl border border-border-soft bg-card p-5 text-xs leading-relaxed text-muted-foreground">
              <h2 className="text-sm font-semibold text-foreground">General offer terms</h2>
              <p>• One coupon per order. The welcome offer and referral bonus apply automatically on a first order and can be combined with a coupon.</p>
              <p>• Discounts apply to the item price before GST; delivery, GST and the platform fee are shown separately at checkout.</p>
              <p>• Cashback is not credited on cancelled or returned orders. A cancelled order gets back any cashback it used.</p>
              <p>• Cashback cannot be withdrawn as cash or transferred. KTMONA may cancel rewards obtained through misuse (fake accounts, self-referrals).</p>
              <p>• Offers can change or end without notice; the price shown at checkout is final.</p>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function RewardCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-2xl border border-border-soft bg-card p-5">
      <Icon className="h-6 w-6 text-brand-strong" />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
