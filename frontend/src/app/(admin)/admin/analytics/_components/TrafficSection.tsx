"use client";

import * as React from "react";
import useSWR from "swr";
import { Eye, Globe, Store, UserPlus } from "lucide-react";
import { adminCenter } from "@/services/admin-center";
import { ErrorNote, StatCard, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const daysAgo = (n: number) => iso(new Date(Date.now() - n * DAY_MS));
const num = (n: number) => n.toLocaleString("en-IN");
const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
  { label: "90 days", days: 89 },
];

/**
 * Website traffic for a chosen date range: visitors, seller sign-up attempts
 * and product views. Days are UTC calendar days.
 */
export function TrafficSection() {
  const [from, setFrom] = React.useState(daysAgo(29));
  const [to, setTo] = React.useState(today());
  const invalid = from > to;
  const { data, error, isLoading, mutate } = useSWR(invalid ? null : ["admin-traffic", from, to], () => adminCenter.traffic({ from, to }), { keepPreviousData: true });

  const activePreset = PRESETS.find((p) => to === today() && from === daysAgo(p.days))?.label;
  const t = data?.totals;
  const dash = (v: number | undefined) => (v === undefined ? "—" : num(v));
  const days = [...(data?.series ?? [])].reverse();

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Website traffic</h2>
          <p className="text-sm text-muted-foreground">Visitors, seller registrations and product views for the dates you pick.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setFrom(daysAgo(p.days)); setTo(today()); }}
                className={cn(
                  "h-10 rounded-lg border px-3 text-sm font-medium",
                  activePreset === p.label ? "border-brand bg-brand/10 text-brand-strong" : "border-border-soft bg-card hover:bg-mist"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="text-xs text-muted-foreground">
            From
            <input type="date" className={cn(inputCls, "mt-1 w-40")} value={from} max={to || today()} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <input type="date" className={cn(inputCls, "mt-1 w-40")} value={to} min={from} max={today()} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
      </div>

      {invalid ? <p className="text-sm text-red-600">&quot;From&quot; must be on or before &quot;To&quot;.</p> : null}
      {error && !data ? <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /> : null}

      <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", isLoading && "opacity-60")}>
        <StatCard icon={Globe} tone="blue" label="Website visitors" value={dash(t?.visitors)} sub={t ? `${num(t.visits)} visits (a visitor counts once a day)` : undefined} />
        <StatCard
          icon={Store}
          tone="orange"
          label="Seller registration tries"
          value={dash(t?.sellerSignupViews)}
          sub={t ? `${num(t.sellerSignupSubmits)} submitted the form · ${num(t.sellersRegistered)} registered` : undefined}
        />
        <StatCard
          icon={Eye}
          tone="green"
          label="Product views"
          value={dash(t?.productViews)}
          sub={t ? `${num(t.productViewers)} visitors · ${num(t.customersViewingProducts)} signed-in customers` : undefined}
        />
        <StatCard icon={UserPlus} tone="navy" label="New customers" value={dash(t?.customersRegistered)} sub="Customer accounts created" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
          <div className="border-b border-border-soft px-5 py-3">
            <p className="text-sm font-semibold">Day by day</p>
            <p className="text-xs text-muted-foreground">{data ? `${fmtDay(data.from)} – ${fmtDay(data.to)}` : " "}</p>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-mist text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 text-right font-semibold">Visitors</th>
                  <th className="px-3 py-2 text-right font-semibold">Seller tries</th>
                  <th className="px-3 py-2 text-right font-semibold">Sellers registered</th>
                  <th className="px-5 py-2 text-right font-semibold">Product views</th>
                </tr>
              </thead>
              <tbody>
                {days.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">{isLoading ? "Loading…" : "No data for these dates."}</td></tr>
                ) : (
                  days.map((d) => (
                    <tr key={d.day} className="border-t border-border-soft">
                      <td className="px-5 py-2 whitespace-nowrap">{fmtDay(d.day)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(d.visitors)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(d.sellerSignupViews)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(d.sellersRegistered)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{num(d.productViews)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
          <div className="border-b border-border-soft px-5 py-3">
            <p className="text-sm font-semibold">Most viewed products</p>
            <p className="text-xs text-muted-foreground">Unique visitors in this period</p>
          </div>
          {!data || data.topProducts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">{isLoading ? "Loading…" : "No product views for these dates."}</p>
          ) : (
            <ol className="divide-y divide-border-soft text-sm">
              {data.topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="text-right tabular-nums">
                    <b>{num(p.viewers)}</b>
                    <span className="block text-[11px] text-muted-foreground">{num(p.customers)} customers</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Counting started with this release, so earlier dates show only product views and registrations. Dates are in UTC (a day starts at 5:30 am IST).
      </p>
    </section>
  );
}
