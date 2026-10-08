"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, BarChart3, HeartPulse, IndianRupee, Lightbulb, Package, ShoppingBag, Star, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sellerCenter, inr, fmtDate, type InsightProduct } from "@/services/seller-center";
import { Btn, Empty, ErrorNote, Loading, PageHeader, PageShell, Panel, StatCard, StatusBadge, Tabs, Thumb, errorMessage } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

type View = "health" | "insights";

export default function PerformancePage() {
  const [view, setView] = React.useState<View>("health");
  return (
    <PageShell>
      <PageHeader
        title="Performance"
        description="Your account health decides how much KTMONA promotes your products. Business insights show what to restock, re-price or promote."
        actions={
          <Link href="/seller/analytics">
            <Btn variant="outline">
              <BarChart3 className="h-4 w-4" /> Detailed sales analytics
            </Btn>
          </Link>
        }
      />
      <div className="px-1">
        <Tabs tabs={[{ key: "health", label: "Account health" }, { key: "insights", label: "Business insights" }]} value={view} onChange={setView} />
      </div>
      {view === "health" ? <Health /> : <Insights />}
    </PageShell>
  );
}

function ScoreRing({ score, status }: { score: number; status: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = status === "GOOD" || status === "NEW" ? "#16a34a" : status === "AT_RISK" ? "#FF8A00" : "#dc2626";
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" aria-label={`Score ${score} out of 100`}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} transform="rotate(-90 65 65)" />
      <text x="65" y="62" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--foreground)">{score}</text>
      <text x="65" y="82" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">out of 100</text>
    </svg>
  );
}

function Health() {
  const { data, error, isLoading, mutate } = useSWR("seller-health", () => sellerCenter.health(30));
  if (error && !data) return <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Loading rows={5} />;
  const maxRating = Math.max(1, ...data.ratings.distribution.map((d) => d.count));
  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Panel>
          <div className="flex flex-col items-center text-center">
            <ScoreRing score={data.score} status={data.status} />
            <div className="mt-2"><StatusBadge status={data.status} /></div>
            <p className="mt-2 text-sm text-muted-foreground">
              Based on {data.orders} order(s) in the last {data.days} days
            </p>
            {data.overdueOrders > 0 ? (
              <Link href="/seller/orders?tab=pending" className="mt-3 text-sm font-semibold text-red-600 hover:underline">
                {data.overdueOrders} order(s) overdue for dispatch →
              </Link>
            ) : null}
          </div>
        </Panel>
        <Panel title="Quality metrics" padded={false}>
          <ul className="divide-y divide-border-soft">
            {data.metrics.map((m) => (
              <li key={m.key} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">Target: {m.target}</p>
                </div>
                <p className="w-20 text-right text-lg font-semibold tabular-nums">{m.value === null ? "—" : `${m.value}${m.unit === "%" ? "%" : ""}`}{m.unit === "★" && m.value !== null ? " ★" : ""}</p>
                <div className="w-24 text-right"><StatusBadge status={m.status} /></div>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title={`Product ratings · ${data.ratings.average ?? "—"} ★ (${data.ratings.count})`}>
          <div className="space-y-2">
            {data.ratings.distribution.map((d) => (
              <div key={d.rating} className="flex items-center gap-3 text-sm">
                <span className="flex w-8 items-center gap-0.5">{d.rating}<Star className="h-3 w-3 fill-current text-amber-500" /></span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${(d.count / maxRating) * 100}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="How to improve">
          {data.tips.length === 0 ? (
            <p className="text-sm text-muted-foreground">You&apos;re doing great. Keep dispatching on time and stock accurate.</p>
          ) : (
            <ul className="space-y-2">
              {data.tips.map((t) => (
                <li key={t} className="flex gap-2 text-sm">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong" />
                  {t}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <Panel title="Penalties">
        <p className="mb-3 text-sm text-muted-foreground">
          {data.lateDispatchPenalty > 0
            ? `Orders dispatched after their dispatch date are charged ${inr.format(data.lateDispatchPenalty)} each, deducted from your payout.`
            : "Late dispatch currently lowers your score but has no charge. Keep dispatching on time."}
        </p>
        {data.penalties.length === 0 ? (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">No penalties. 🎉</p>
        ) : (
          <ul className="divide-y divide-border-soft text-sm">
            {data.penalties.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{p.note} · {fmtDate(p.date)}</span>
                <span className="font-semibold text-red-600">{inr.format(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ProductList({ items, metric }: { items: InsightProduct[]; metric: (p: InsightProduct) => React.ReactNode }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing to show.</p>;
  return (
    <ul className="divide-y divide-border-soft">
      {items.map((p) => (
        <li key={p.productId} className="flex items-center gap-3 py-2.5">
          <Thumb src={p.image} alt={p.title} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.title}</p>
            <p className="text-xs text-muted-foreground">{p.category}</p>
          </div>
          <div className="text-right text-xs">{metric(p)}</div>
        </li>
      ))}
    </ul>
  );
}

function Insights() {
  const [days, setDays] = React.useState(30);
  const { data, error, isLoading, mutate } = useSWR(["seller-insights", days], () => sellerCenter.insights(days), { keepPreviousData: true });
  if (error && !data) return <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />;
  if (isLoading && !data) return <Loading rows={6} />;
  if (!data) return <Empty title="No data yet" />;
  const s = data.summary;
  const totalRevenue = data.categories.reduce((sum, c) => sum + c.revenue, 0) || 1;
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-lg border border-border-soft bg-card px-3 text-sm" aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} tone="blue" label="Sales" value={inr.format(s.revenue)} change={s.revenueChange} />
        <StatCard icon={ShoppingBag} tone="orange" label="Orders" value={s.orders} change={s.ordersChange} />
        <StatCard icon={Package} tone="navy" label="Units sold" value={s.units} change={s.unitsChange} />
        <StatCard icon={TrendingUp} tone="green" label="Avg. order value" value={inr.format(s.avgOrderValue)} />
      </section>

      {data.recommendations.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2">
          {data.recommendations.map((r) => (
            <Link key={r.title} href={r.href} className="flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/6 p-4 transition-colors hover:bg-brand/10">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.detail}</p>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-brand-strong">{r.action}<ArrowRight className="h-3 w-3" /></span>
            </Link>
          ))}
        </section>
      ) : null}

      <Panel title="Sales trend">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trend.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip formatter={(v, n) => (n === "revenue" ? [inr.format(Number(v)), "Sales"] : [String(v), "Units"])} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-brand)" fill="var(--color-brand)" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Top products">
          <ProductList items={data.topProducts} metric={(p) => (<><p className="font-semibold">{inr.format(p.revenue)}</p><p className="text-muted-foreground">{p.units} sold</p></>)} />
        </Panel>
        <Panel title="Sales by category">
          {data.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.categories.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.category}</span>
                    <span className="tabular-nums">{inr.format(c.revenue)} · {c.units} units</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-mist">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(c.revenue / totalRevenue) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Restock soon" action={<Link href="/seller/inventory?filter=low_stock" className="text-sm font-medium text-brand-strong hover:underline">Inventory</Link>}>
          <ProductList items={data.restock} metric={(p) => (<><p className={cn("font-semibold", p.stock <= 0 && "text-red-600")}>{p.stock} left</p><p className="text-muted-foreground">{p.daysOfCover != null ? `~${p.daysOfCover} days` : ""}</p></>)} />
        </Panel>
        <Panel title="Live but not selling" action={<Link href="/seller/pricing" className="text-sm font-medium text-brand-strong hover:underline">Pricing</Link>}>
          <ProductList items={data.notSelling} metric={(p) => (<><p className="text-muted-foreground">Live {p.ageDays} days</p><p className="text-muted-foreground">{p.wishlisted} wishlisted</p></>)} />
        </Panel>
      </section>
    </div>
  );
}
