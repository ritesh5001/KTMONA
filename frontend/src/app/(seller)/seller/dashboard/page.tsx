"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Ban,
  Boxes,
  IndianRupee,
  Package,
  PlusCircle,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Undo2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const RevenueChart = dynamic(() => import("./_components/RevenueChart"), {
  ssr: false,
  loading: () => <div className="h-72 sm:h-80 animate-pulse rounded bg-border-soft dark:bg-border" />,
});

const RefundBarChart = dynamic(() => import("./_components/RefundBarChart"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded bg-border-soft dark:bg-border" />,
});
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  getAnalyticsSummary,
  getRevenueChart,
  getTopProducts,
  getInventoryHealth,
  getRefundImpact,
  type AnalyticsSummary,
  type ChartPoint,
  type TopProduct,
  type InventoryHealth,
  type RefundImpact,
} from "@/services/sellerAnalytics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

const EASE = [0.25, 0.1, 0.25, 1] as const;

/** Icon chip colours for the KPI cards. */
const STAT_TONES = {
  orange: "bg-brand/12 text-brand-strong",
  navy: "bg-ink/8 text-ink dark:bg-white/10 dark:text-white",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  red: "bg-red-500/10 text-red-700 dark:text-red-300",
} as const;

const QUICK_ACTIONS: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  { href: "/seller/products", title: "Add New Product", description: "List your products and reach more buyers", icon: PlusCircle },
  { href: "/seller/products", title: "Manage Inventory", description: "Update stock and avoid running out", icon: Package },
  { href: "/seller/orders", title: "View Orders", description: "Check and manage your orders", icon: ShoppingBag },
  { href: "/seller/settlements", title: "Track Payments", description: "View your earnings and payouts", icon: Wallet },
];
const SKELETON_BAR_HEIGHTS = [42, 68, 51, 84, 37, 73, 58, 91, 46, 79, 62, 88] as const;

// ─── Skeleton Primitives ─────────────────────────────────────────────────────

function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded bg-border-soft dark:bg-border ${className}`}
      style={style}
    />
  );
}

function StatSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border-soft bg-card p-5">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-24" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <div className="flex items-end gap-2 h-64">
        {SKELETON_BAR_HEIGHTS.map((height, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ─── Empty / Error states ────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-border-soft dark:bg-border flex items-center justify-center mb-4">
        <svg
          className="h-6 w-6 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 rounded-md p-4 flex items-center justify-between">
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ─── SWR Fetcher wrappers ────────────────────────────────────────────────────

const summaryFetcher = () => getAnalyticsSummary();
const topProductsFetcher = () => getTopProducts(10);
const inventoryFetcher = () => getInventoryHealth();
const refundFetcher = () => getRefundImpact();

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SellerDashboardPage() {
  const [chartInterval, setChartInterval] = React.useState<
    "daily" | "weekly" | "monthly"
  >("daily");
  const [topSortKey, setTopSortKey] = React.useState<keyof TopProduct>("unitsSold");
  const [topSortDir, setTopSortDir] = React.useState<"asc" | "desc">("desc");
  const [topPage, setTopPage] = React.useState(0);
  const TOP_PER_PAGE = 5;

  // ── SWR hooks ────────────────────────────────────────────────────────
  const {
    data: summary,
    error: summaryErr,
    isLoading: summaryLoading,
    mutate: retrySummary,
  } = useSWR<AnalyticsSummary>("seller-analytics-summary", summaryFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    onError: (e: Error) => toast.error(e.message ?? "Failed to load summary"),
  });

  const chartKey = `seller-analytics-chart-${chartInterval}`;
  const {
    data: chartData,
    error: chartErr,
    isLoading: chartLoading,
    mutate: retryChart,
  } = useSWR<ChartPoint[]>(chartKey, () => getRevenueChart(chartInterval), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const {
    data: topProducts,
    error: topErr,
    isLoading: topLoading,
    mutate: retryTop,
  } = useSWR<TopProduct[]>("seller-analytics-top", topProductsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const {
    data: inventory,
    error: inventoryErr,
    isLoading: inventoryLoading,
    mutate: retryInventory,
  } = useSWR<InventoryHealth>("seller-analytics-inventory", inventoryFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const {
    data: refundData,
    error: refundErr,
    isLoading: refundLoading,
    mutate: retryRefund,
  } = useSWR<RefundImpact>("seller-analytics-refund", refundFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  // ── Derived data ─────────────────────────────────────────────────────
  const sortedProducts = React.useMemo(() => {
    if (!topProducts) return [];
    const copy = [...topProducts];
    copy.sort((a, b) => {
      const av = a[topSortKey] as number;
      const bv = b[topSortKey] as number;
      return topSortDir === "desc" ? bv - av : av - bv;
    });
    return copy;
  }, [topProducts, topSortKey, topSortDir]);

  const pagedProducts = sortedProducts.slice(
    topPage * TOP_PER_PAGE,
    (topPage + 1) * TOP_PER_PAGE,
  );
  const totalPages = Math.ceil(sortedProducts.length / TOP_PER_PAGE);

  const handleSort = (key: keyof TopProduct) => {
    if (key === topSortKey) {
      setTopSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setTopSortKey(key);
      setTopSortDir("desc");
    }
    setTopPage(0);
  };

  // ── KPI stat cards config ────────────────────────────────────────────
  const statCards = React.useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Total Revenue", value: currency.format(summary.totalRevenue), icon: IndianRupee, tone: "blue" },
      { label: "Net Revenue", value: currency.format(summary.netRevenue), icon: TrendingUp, tone: "green" },
      { label: "Orders", value: compact.format(summary.totalOrders), icon: ShoppingBag, tone: "orange" },
      { label: "Units Sold", value: compact.format(summary.totalUnitsSold), icon: Boxes, tone: "navy" },
      { label: "Avg Order Value", value: currency.format(summary.averageOrderValue), icon: ReceiptText, tone: "blue" },
      { label: "Refund Impact", value: currency.format(summary.totalRefundAmount), icon: RotateCcw, tone: "red" },
      { label: "Return Rate", value: pct(summary.returnRate), icon: Undo2, tone: "orange" },
      { label: "Cancellation Rate", value: pct(summary.cancellationRate), icon: Ban, tone: "red" },
    ] satisfies { label: string; value: string; icon: LucideIcon; tone: keyof typeof STAT_TONES }[];
  }, [summary]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        {/* ── Welcome banner ─────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl border border-border-soft bg-gradient-to-r from-[#EAF1FF] via-[#F3F6FD] to-[#FFF1E0] p-6 dark:from-[#12224D] dark:via-[#0E1A3A] dark:to-[#2A1A08] sm:p-8">
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Welcome back 👋
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                Grow your business with KTMONA. Live insights into your revenue, inventory, top
                products and refunds.
              </p>
            </div>
            <div className="hidden text-right text-lg font-semibold leading-snug text-ink dark:text-white md:block">
              <p>More Sellers</p>
              <p className="text-brand-strong">More Customers</p>
              <p>Bigger Growth</p>
            </div>
          </div>
        </section>

        {/* ── Quick actions ──────────────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={title}
              href={href}
              className="group flex items-start gap-4 rounded-2xl border border-border-soft bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand/50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-strong transition-colors group-hover:bg-brand group-hover:text-ink">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
              </span>
            </Link>
          ))}
        </section>

        {/* ── KPI Cards ──────────────────────────────────────────── */}
        {summaryErr ? (
          <ErrorBanner
            message="Unable to load summary metrics"
            onRetry={() => retrySummary()}
          />
        ) : summaryLoading ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.03, duration: 0.5, ease: EASE }}
                  className="flex items-start gap-4 rounded-2xl border border-border-soft bg-card p-5"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${STAT_TONES[stat.tone]}`}>
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
                      {stat.value}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </section>
        )}

        {/* ── Revenue Chart ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Revenue Over Time</CardTitle>
                <CardDescription>
                  Gross revenue from confirmed &amp; delivered orders
                </CardDescription>
              </div>
              <div className="flex gap-1 rounded-sm border border-border-soft p-0.5">
                {(["daily", "weekly", "monthly"] as const).map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setChartInterval(iv)}
                    className={`rounded-sm px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide transition-all duration-300 ${
                      chartInterval === iv
                        ? "bg-ink text-paper dark:bg-brand dark:text-ink"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {iv}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartErr ? (
              <ErrorBanner
                message="Unable to load chart data"
                onRetry={() => retryChart()}
              />
            ) : chartLoading ? (
              <ChartSkeleton />
            ) : !chartData || chartData.length === 0 ? (
              <EmptyState message="No revenue data available yet. Revenue will appear here once orders are confirmed." />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={chartInterval}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="h-72 sm:h-80"
                >
                  <RevenueChart data={chartData} interval={chartInterval} />
                </motion.div>
              </AnimatePresence>
            )}
          </CardContent>
        </Card>

        {/* ── Two-column: Top Products + Inventory ───────────────── */}
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best sellers by units sold. Click column headers to sort.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topErr ? (
                <div className="p-6">
                  <ErrorBanner message="Unable to load products" onRetry={() => retryTop()} />
                </div>
              ) : topLoading ? (
                <TableSkeleton />
              ) : !topProducts || topProducts.length === 0 ? (
                <EmptyState message="No product data yet. Sell some products to see analytics here." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-soft text-left">
                          <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Product
                          </th>
                          {([
                            ["unitsSold", "Units"],
                            ["revenue", "Revenue"],
                            ["returnCount", "Returns"],
                            ["ratingAverage", "Rating"],
                          ] as const).map(([key, label]) => (
                            <th
                              key={key}
                              onClick={() => handleSort(key)}
                              className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                            >
                              <span className="inline-flex items-center gap-1">
                                {label}
                                {topSortKey === key && (
                                  <span className="text-brand-strong">{topSortDir === "desc" ? "↓" : "↑"}</span>
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {pagedProducts.map((p, i) => (
                            <motion.tr
                              key={p.productId}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ delay: i * 0.03, duration: 0.3 }}
                              className="border-b border-border-soft last:border-0 hover:bg-mist/40 dark:hover:bg-navy/10 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  {p.image ? (
                                    <img
                                      src={p.image}
                                      alt={p.title}
                                      className="h-9 w-9 rounded object-cover bg-border-soft"
                                    />
                                  ) : (
                                    <div className="h-9 w-9 rounded bg-border-soft dark:bg-border flex items-center justify-center text-[10px] text-muted-foreground">
                                      N/A
                                    </div>
                                  )}
                                  <span className="font-medium text-foreground line-clamp-1 max-w-[180px]">
                                    {p.title}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 tabular-nums">{p.unitsSold}</td>
                              <td className="px-4 py-4 tabular-nums">{currency.format(p.revenue)}</td>
                              <td className="px-4 py-4 tabular-nums">{p.returnCount}</td>
                              <td className="px-4 py-4">
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <span className="text-brand-strong">★</span>
                                  {p.ratingAverage.toFixed(1)}
                                </span>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border-soft px-6 py-3">
                      <p className="text-[11px] text-muted-foreground">
                        Page {topPage + 1} of {totalPages}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={topPage <= 0}
                          onClick={() => setTopPage((p) => p - 1)}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={topPage >= totalPages - 1}
                          onClick={() => setTopPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Inventory Health */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Health</CardTitle>
              <CardDescription>Stock status and fast-moving items</CardDescription>
            </CardHeader>
            <CardContent>
              {inventoryErr ? (
                <ErrorBanner message="Unable to load inventory" onRetry={() => retryInventory()} />
              ) : inventoryLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !inventory ? (
                <EmptyState message="No inventory data available." />
              ) : (
                <div className="space-y-6">
                  {/* Badges row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-md border border-border-soft p-3 text-center">
                      <p className="font-serif text-xl font-light text-foreground">
                        {inventory.totalVariants}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                        Total SKUs
                      </p>
                    </div>
                    <div
                      className={`rounded-md border p-3 text-center ${
                        inventory.lowStockProducts > 0
                          ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
                          : "border-border-soft"
                      }`}
                    >
                      <p className="font-serif text-xl font-light text-foreground">
                        {inventory.lowStockProducts}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                        Low Stock
                      </p>
                    </div>
                    <div
                      className={`rounded-md border p-3 text-center ${
                        inventory.outOfStockProducts > 0
                          ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                          : "border-border-soft"
                      }`}
                    >
                      <p className="font-serif text-xl font-light text-foreground">
                        {inventory.outOfStockProducts}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                        Out of Stock
                      </p>
                    </div>
                  </div>

                  {/* Fast movers */}
                  {inventory.fastMovingProducts.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong mb-3">
                        Fast Moving (30 days)
                      </p>
                      <div className="space-y-2">
                        {inventory.fastMovingProducts.map((p) => (
                          <div
                            key={p.productId}
                            className="flex items-center gap-3 rounded border border-border-soft px-3 py-2 hover:bg-mist/40 dark:hover:bg-navy/10 transition-colors"
                          >
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.title}
                                className="h-7 w-7 rounded object-cover bg-border-soft"
                              />
                            ) : (
                              <div className="h-7 w-7 rounded bg-border-soft" />
                            )}
                            <span className="text-xs font-medium text-foreground flex-1 line-clamp-1">
                              {p.title}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {p.unitsSold} sold
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inventory.fastMovingProducts.length === 0 &&
                    inventory.totalVariants === 0 && (
                      <EmptyState message="Add products to track inventory health." />
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Refund Impact ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Refund Impact</CardTitle>
                <CardDescription>
                  Financial impact of returns and refunds on your store
                </CardDescription>
              </div>
              {refundData && (
                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Total Refunds
                    </p>
                    <p className="font-serif text-lg font-light text-foreground">
                      {refundData.totalRefunds}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Revenue Impact
                    </p>
                    <p className="font-serif text-lg font-light text-foreground">
                      {currency.format(refundData.refundRevenueImpact)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {refundErr ? (
              <ErrorBanner message="Unable to load refund data" onRetry={() => retryRefund()} />
            ) : refundLoading ? (
              <ChartSkeleton />
            ) : !refundData || refundData.mostReturnedProducts.length === 0 ? (
              <EmptyState message="No returns or refunds recorded yet — great news for your store!" />
            ) : (
              <div className="h-64">
                <RefundBarChart data={refundData.mostReturnedProducts} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Quick Links Footer ─────────────────────────────────── */}
        <section className="border-t border-border-soft pt-6">
          <div className="flex flex-wrap items-center justify-center gap-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Real-time Data
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Cached for 5 min
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Rate Limited
            </span>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
