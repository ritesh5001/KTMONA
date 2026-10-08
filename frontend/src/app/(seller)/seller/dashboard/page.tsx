"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import useSWR from "swr";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Headset,
  IndianRupee,
  Megaphone,
  Package,
  PackageCheck,
  PlusCircle,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  Wallet,
} from "lucide-react";
import { sellerCenter, inr, fmtDate, shortId } from "@/services/seller-center";
import { Btn, Empty, ErrorNote, Panel, StatCard, StatusBadge, Thumb, errorMessage } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

const SalesOverviewChart = dynamic(() => import("./_components/SalesOverviewChart"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse rounded-xl bg-mist" />,
});

const RANGES = [
  { days: 7, label: "Last 7 Days" },
  { days: 30, label: "Last 30 Days" },
  { days: 90, label: "Last 90 Days" },
];

export default function SellerDashboardPage() {
  const [days, setDays] = React.useState(7);
  const { data: notices } = useSWR("seller-announcements", () => sellerCenter.announcements(), { revalidateOnFocus: false });
  const { data, error, isLoading, mutate } = useSWR(["seller-overview", days], () => sellerCenter.overview(days), {
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  if (error && !data) {
    return (
      <div className="p-6">
        <ErrorNote message={errorMessage(error, "Could not load your dashboard")} onRetry={() => mutate()} />
      </div>
    );
  }

  const o = data;
  const storeName = o?.seller.storeName ?? "Seller";
  const pendingChecklist = o?.checklist.filter((c) => !c.done) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-2xl border border-border-soft bg-gradient-to-r from-[#EAF1FF] via-[#F3F6FD] to-[#FFF1E0] px-6 py-6 dark:from-[#12224D] dark:via-[#0E1A3A] dark:to-[#2A1A08] sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back, {storeName}! 👋</h1>
            <p className="mt-1 text-sm text-muted-foreground">Grow your business with KTMONA</p>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <StoreIllustration />
            <div className="text-right text-lg font-semibold leading-snug">
              <p className="text-ink dark:text-white">More Sellers</p>
              <p className="text-brand-strong">More Customers</p>
              <p className="text-ink dark:text-white">Bigger Growth</p>
            </div>
          </div>
        </div>
      </section>

      {/* KTMONA notices */}
      {notices && notices.length > 0 ? (
        <div className="space-y-2">
          {notices.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center",
                n.level === "WARNING" && "border-brand/30 bg-brand/8",
                n.level === "SUCCESS" && "border-emerald-500/25 bg-emerald-500/5",
                n.level === "INFO" && "border-blue-500/20 bg-blue-500/5"
              )}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.body}</p>
              </div>
              {n.linkUrl ? (
                <Link href={n.linkUrl}>
                  <Btn size="sm" variant={n.level === "SUCCESS" ? "brand" : "outline"}>{n.linkLabel ?? "Open"}</Btn>
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Alerts */}
      {o && o.alerts.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-2">
          {o.alerts.map((a) => (
            <Link
              key={a.text}
              href={a.href}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                a.tone === "danger" && "border-red-500/25 bg-red-500/5 text-red-700 hover:bg-red-500/10 dark:text-red-300",
                a.tone === "warning" && "border-brand/30 bg-brand/8 text-brand-strong hover:bg-brand/12",
                a.tone === "info" && "border-border-soft bg-card text-foreground hover:bg-mist"
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{a.text}</span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
            </Link>
          ))}
        </div>
      ) : null}

      {/* Onboarding checklist */}
      {pendingChecklist.length > 0 ? (
        <Panel title={`Finish setting up your store (${o!.checklist.length - pendingChecklist.length}/${o!.checklist.length})`}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {o!.checklist.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                  c.done ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : "border-border-soft hover:border-brand/50"
                )}
              >
                {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="font-medium">{c.label}</span>
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} tone="orange" label="Total Orders" value={o ? o.stats.totalOrders.value.toLocaleString("en-IN") : "—"} change={o?.stats.totalOrders.change} href="/seller/orders?tab=all" />
        <StatCard icon={IndianRupee} tone="blue" label="Total Sales" value={o ? inr.format(o.stats.totalSales.value) : "—"} change={o?.stats.totalSales.change} href="/seller/settlements" />
        <StatCard
          icon={ShoppingBag}
          tone="blue"
          label="Active Products"
          value={o ? o.stats.activeProducts.value : "—"}
          sub={o ? `${o.stats.activeProducts.addedInRange} went live in this period` : undefined}
          href="/seller/products?tab=live"
        />
        <StatCard
          icon={Star}
          tone="amber"
          label="Rating"
          value={o?.stats.rating.value ? `${o.stats.rating.value} / 5` : "—"}
          sub={o ? `(from ${o.stats.rating.reviews} reviews)` : undefined}
          href="/seller/performance"
        />
      </section>

      {/* Sales overview + order status */}
      <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border-soft bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Sales Overview</h2>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{o ? inr.format(o.stats.totalSales.value) : "—"}</p>
              {o && o.stats.totalSales.change !== null ? (
                <p className="mt-1 text-xs">
                  <span className={cn("font-semibold", o.stats.totalSales.change >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {o.stats.totalSales.change >= 0 ? "↑" : "↓"} {Math.abs(o.stats.totalSales.change)}%
                  </span>{" "}
                  <span className="text-muted-foreground">(vs. previous {days} days)</span>
                </p>
              ) : null}
            </div>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-9 rounded-lg border border-border-soft bg-card px-3 text-sm text-foreground focus:border-brand focus:outline-none"
              aria-label="Date range"
            >
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 h-64">{o ? <SalesOverviewChart data={o.series} /> : <div className="h-full animate-pulse rounded-xl bg-mist" />}</div>
        </div>

        <div className="rounded-2xl border border-border-soft bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Order Status</h2>
            <Link href="/seller/orders" className="text-sm font-medium text-brand-strong hover:underline">
              View All
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {[
              { label: "Pending", value: o?.orderStatus.pending, icon: Clock, tone: "bg-brand/12 text-brand-strong", tab: "pending" },
              { label: "Ready to Ship", value: o?.orderStatus.readyToShip, icon: Package, tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300", tab: "ready_to_ship" },
              { label: "Shipped", value: o?.orderStatus.shipped, icon: Truck, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", tab: "shipped" },
              { label: "Delivered", value: o?.orderStatus.delivered, icon: PackageCheck, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", tab: "delivered" },
            ].map((s) => (
              <Link key={s.label} href={`/seller/orders?tab=${s.tab}`} className="flex items-center gap-3 rounded-xl border border-border-soft px-3 py-3 transition-colors hover:border-brand/40 hover:bg-mist/50">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", s.tone)}>
                  <s.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span className="flex-1 text-sm font-medium text-foreground">{s.label}</span>
                <span className="text-base font-semibold tabular-nums text-foreground">{s.value ?? "—"}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/seller/products/new", title: "Add New Product", text: "List your products and reach more buyers", icon: PlusCircle },
          { href: "/seller/inventory", title: "Manage Inventory", text: "Update stock and avoid out of stock", icon: Boxes },
          { href: "/seller/orders", title: "View Orders", text: "Check and manage your orders", icon: ShoppingBag },
          { href: "/seller/settlements", title: "Track Payments", text: "View your earnings and payouts", icon: Wallet },
        ].map((q) => (
          <Link key={q.title} href={q.href} className="group flex items-start gap-4 rounded-2xl border border-border-soft bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand/50">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand-strong transition-colors group-hover:bg-brand group-hover:text-ink">
              <q.icon className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{q.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{q.text}</span>
            </span>
          </Link>
        ))}
      </section>

      {/* Recent orders + top products */}
      <section className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">Recent Orders</h2>
            <Link href="/seller/orders?tab=all" className="text-sm font-medium text-brand-strong hover:underline">
              View All Orders
            </Link>
          </div>
          {isLoading && !o ? (
            <div className="space-y-2 px-5 pb-5">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-mist" />)}</div>
          ) : o && o.recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Order ID</th>
                    <th className="px-3 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Amount</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {o.recentOrders.map((r) => {
                    const first = r.items[0];
                    return (
                      <tr key={r.orderId} className="border-b border-border-soft last:border-0">
                        <td className="whitespace-nowrap px-5 py-3 font-semibold text-foreground">
                          <Link href={`/seller/orders?order=${r.orderId}`} className="hover:text-brand-strong">
                            {shortId(r.orderId)}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb src={first?.image ?? null} alt={first?.title ?? ""} />
                            <div className="min-w-0">
                              <p className="max-w-[160px] truncate font-medium text-foreground">{first?.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.units} × {[first?.size !== "Default" ? first?.size : null, first?.color].filter(Boolean).join(", ") || "Standard"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{r.customer.name ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums">{inr.format(r.sellerAmount)}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{fmtDate(r.orderDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No orders yet" text="Your orders will show up here as soon as customers buy." />
          )}
        </div>

        <div className="rounded-2xl border border-border-soft bg-card">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">Top Selling Products</h2>
            <Link href="/seller/performance" className="text-sm font-medium text-brand-strong hover:underline">
              View All
            </Link>
          </div>
          {o && o.topProducts.length > 0 ? (
            <ul className="divide-y divide-border-soft">
              {o.topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <Thumb src={p.image} alt={p.title} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                    <p className="text-sm font-semibold text-foreground">{p.price != null ? inr.format(p.price) : "—"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{p.sold} sold</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No sales yet" text="Your bestsellers will appear here." />
          )}
        </div>
      </section>

      {/* Bottom cards */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Megaphone, title: "Grow Your Sales", text: "Use offers, discounts, ads and better product images to get more orders.", cta: "Explore Marketing Tools", href: "/seller/ads", primary: true },
          { icon: ShieldCheck, title: "Seller Protection", text: "Safe payments, easy returns and claims for damaged returns.", cta: "Know More", href: "/seller/returns?view=claims" },
          { icon: Headset, title: "Need Help?", text: "Get quick answers to your queries from our support team.", cta: "Contact Support", href: "/seller/support" },
        ].map((c) => (
          <div key={c.title} className="flex items-start gap-4 rounded-2xl border border-border-soft bg-gradient-to-br from-card to-mist/60 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand-strong">
              <c.icon className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{c.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.text}</p>
              <Link href={c.href} className="mt-3 inline-block">
                <Btn size="sm" variant={c.primary ? "primary" : "outline"}>
                  {c.cta}
                </Btn>
              </Link>
            </div>
          </div>
        ))}
      </section>

      {o?.payments.nextPayout.date ? (
        <p className="text-center text-xs text-muted-foreground">
          Next payout: <span className="font-semibold text-foreground">{inr.format(o.payments.nextPayout.amount)}</span> on {fmtDate(o.payments.nextPayout.date)} ·{" "}
          <Link href="/seller/settlements" className="text-brand-strong hover:underline">
            Payments
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function StoreIllustration() {
  return (
    <svg width="110" height="78" viewBox="0 0 110 78" aria-hidden className="shrink-0">
      <rect x="14" y="30" width="82" height="44" rx="4" fill="#fff" stroke="#0C1B42" strokeWidth="2" />
      <path d="M8 30 L18 10 H92 L102 30 Z" fill="#FF8A00" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${8 + i * 18.8} 30 q9.4 10 18.8 0`} fill={i % 2 ? "#fff" : "#FFAA02"} stroke="#0C1B42" strokeWidth="1.5" />
      ))}
      <rect x="44" y="46" width="22" height="28" rx="2" fill="#2A3D7A" />
      <rect x="22" y="44" width="16" height="14" rx="2" fill="#DDE5F4" stroke="#0C1B42" strokeWidth="1.5" />
      <rect x="72" y="44" width="16" height="14" rx="2" fill="#DDE5F4" stroke="#0C1B42" strokeWidth="1.5" />
      <rect x="0" y="62" width="14" height="12" rx="1.5" fill="#FFAA02" />
      <rect x="96" y="58" width="14" height="16" rx="1.5" fill="#FF8A00" />
    </svg>
  );
}
