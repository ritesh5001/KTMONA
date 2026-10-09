"use client";

import { ADS_ENABLED } from "@/lib/features";
import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { ArrowRight, Banknote, ChevronRight, IndianRupee, Package, ShoppingBag, Store, TrendingUp, Wallet } from "lucide-react";
import { adminCenter } from "@/services/admin-center";
import { inr, fmtDate, shortId } from "@/services/seller-center";
import { Empty, ErrorNote, PageHeader, PageShell, Panel, StatCard, StatusBadge, errorMessage } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

const GmvChart = dynamic(() => import("./_components/GmvChart"), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-xl bg-mist" /> });

export default function AdminDashboardPage() {
  const [days, setDays] = React.useState(30);
  const { data: d, error, mutate } = useSWR(["admin-dashboard", days], () => adminCenter.dashboard(days), { keepPreviousData: true });

  if (error && !d) return <div className="p-6"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>;

  const pending = d?.actionCenter.filter((a) => a.count > 0) ?? [];

  return (
    <PageShell>
      <PageHeader
        title="KTMONA Operations"
        description="Marketplace health at a glance, and everything waiting on the admin team."
        actions={
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-lg border border-border-soft bg-card px-3 text-sm" aria-label="Period">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} tone="blue" label="GMV" value={d ? inr.format(d.kpis.gmv.value) : "—"} change={d?.kpis.gmv.change} />
        <StatCard icon={ShoppingBag} tone="orange" label="Orders" value={d ? d.kpis.orders.value.toLocaleString("en-IN") : "—"} change={d?.kpis.orders.change} sub={d ? `AOV ${inr.format(d.kpis.aov)}` : undefined} />
        <StatCard
          icon={TrendingUp}
          tone="green"
          label="Platform revenue"
          value={d ? inr.format(d.kpis.platformRevenue) : "—"}
          sub={d ? `Commission ${inr.format(d.kpis.commission)}${ADS_ENABLED ? ` · Ads ${inr.format(d.kpis.adRevenue)}` : ""}` : undefined}
        />
        <StatCard icon={Store} tone="navy" label="Active sellers" value={d?.kpis.activeSellers ?? "—"} sub={d ? `${d.kpis.liveProducts} live products` : undefined} href="/admin/sellers?tab=active" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="GMV trend">
          <div className="h-64">{d ? <GmvChart data={d.series} /> : <div className="h-full animate-pulse rounded-xl bg-mist" />}</div>
        </Panel>
        <Panel title="Action center" padded={false}>
          {d && pending.length === 0 ? (
            <Empty title="All caught up" text="Nothing is waiting on the admin team." />
          ) : (
            <ul className="divide-y divide-border-soft">
              {(d?.actionCenter ?? []).map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-mist/50">
                    <span className="flex-1 text-sm font-medium">{a.label}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", a.count > 0 ? (a.key === "sla" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-brand text-ink") : "bg-mist text-muted-foreground")}>
                      {a.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {d ? (
        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/admin/payouts" className="flex items-start gap-4 rounded-2xl border border-border-soft bg-card p-5 hover:border-brand/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><Banknote className="h-5 w-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Payouts due now</p>
              <p className="text-2xl font-semibold">{inr.format(d.payoutsDue.payableAmount)}</p>
              <p className="text-xs text-muted-foreground">{d.payoutsDue.payableSellers} seller(s){d.payoutsDue.onHoldAmount ? ` · ${inr.format(d.payoutsDue.onHoldAmount)} on hold` : ""}</p>
            </div>
          </Link>
          <Link href="/admin/sellers?tab=pending" className="flex items-start gap-4 rounded-2xl border border-border-soft bg-card p-5 hover:border-brand/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/12 text-brand-strong"><Store className="h-5 w-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Sellers</p>
              <p className="text-2xl font-semibold">{(d.sellerCounts.ACTIVE ?? 0) + (d.sellerCounts.PENDING ?? 0) + (d.sellerCounts.SUSPENDED ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{d.sellerCounts.ACTIVE ?? 0} active · {d.sellerCounts.PENDING ?? 0} pending · {d.sellerCounts.SUSPENDED ?? 0} suspended</p>
            </div>
          </Link>
          <Link href="/admin/catalog-qc" className="flex items-start gap-4 rounded-2xl border border-border-soft bg-card p-5 hover:border-brand/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/10 text-blue-700"><Package className="h-5 w-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Catalog</p>
              <p className="text-2xl font-semibold">{d.kpis.liveProducts}</p>
              <p className="text-xs text-muted-foreground">live products · {d.actionCenter.find((a) => a.key === "qc")?.count ?? 0} in QC</p>
            </div>
          </Link>
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-medium text-brand-strong hover:underline">View all</Link>
          </div>
          {d && d.recentOrders.length === 0 ? (
            <Empty title="No orders yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Order</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Seller</th>
                    <th className="px-3 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(d?.recentOrders ?? []).map((o) => (
                    <tr key={o.id} className="border-b border-border-soft last:border-0">
                      <td className="whitespace-nowrap px-5 py-3"><p className="font-semibold">{shortId(o.id)}</p><p className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</p></td>
                      <td className="px-3 py-3"><p>{o.customer ?? "—"}</p><p className="text-xs text-muted-foreground">{o.city}</p></td>
                      <td className="max-w-[160px] truncate px-3 py-3 text-muted-foreground">{o.sellers.join(", ")}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums">{inr.format(o.amount)}</td>
                      <td className="px-5 py-3"><StatusBadge status={o.status === "CONFIRMED" ? "PENDING" : o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="space-y-5">
          <Panel title="Top sellers" padded={false}>
            {d && d.topSellers.length === 0 ? <p className="px-5 py-4 text-sm text-muted-foreground">No sales in this period.</p> : (
              <ul className="divide-y divide-border-soft">
                {(d?.topSellers ?? []).map((s, i) => (
                  <li key={s.sellerId}>
                    <Link href={`/admin/sellers/${s.sellerId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-mist/50">
                      <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.storeName ?? s.code}</p><p className="text-xs text-muted-foreground">{s.orders} orders</p></div>
                      <span className="text-sm font-semibold tabular-nums">{inr.format(s.gmv)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Top categories" padded={false}>
            {d && d.topCategories.length === 0 ? <p className="px-5 py-4 text-sm text-muted-foreground">No sales in this period.</p> : (
              <ul className="divide-y divide-border-soft">
                {(d?.topCategories ?? []).map((c) => (
                  <li key={c.name} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{c.units} units · <b className="text-foreground">{inr.format(c.gmv)}</b></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Link href="/admin/analytics" className="flex items-center justify-between rounded-2xl border border-border-soft bg-card px-5 py-4 text-sm font-semibold hover:border-brand/40">
            <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-brand-strong" /> Profit & detailed analytics</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
