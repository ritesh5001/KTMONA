"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import useSWR from "swr";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  KeyRound,
  ListTodo,
  Megaphone,
  PackageX,
  Printer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supplier } from "@/services/seller-supplier";
import { Btn, ErrorNote, Panel, errorMessage } from "@/components/seller/kit";
import { RtoCard } from "@/components/seller/RtoCard";
import { cn } from "@/lib/utils";

const InsightsChart = dynamic(() => import("./_components/InsightsChart"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse rounded-xl bg-mist" />,
});

type Range = "daily" | "weekly" | "monthly";

function fmtShort(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ChangePill({ value }: { value: number | null }) {
  if (value === null || value === 0) return null;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-emerald-600" : "text-red-600")}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value)}%
    </span>
  );
}

export default function SellerHomePage() {
  const [range, setRange] = React.useState<Range>("daily");
  const [metric, setMetric] = React.useState<"views" | "orders">("views");
  const { data, error, mutate } = useSWR(["seller-home", range], () => supplier.home(range), {
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  if (error && !data) {
    return (
      <div className="p-6">
        <ErrorNote message={errorMessage(error, "Could not load your home page")} onRetry={() => mutate()} />
      </div>
    );
  }

  const last = data?.insights.series.at(-1);
  const lastLabel = last ? (range === "daily" ? fmtShort(last.start) : `${fmtShort(last.start)} – ${fmtShort(last.end)}`) : "";
  const policy = data?.announcements.find((a) => a.level === "WARNING") ?? data?.announcements[0];

  const todo = [
    { label: "Pending Orders", value: data?.todo.pendingOrders, href: "/seller/orders?tab=pending", icon: ClipboardList },
    { label: "Download Labels", value: data?.todo.downloadLabels, href: "/seller/orders?tab=ready_to_ship", icon: Printer },
    { label: "Out of Stock", value: data?.todo.outOfStock, href: "/seller/inventory?stock=out_of_stock", icon: PackageX },
    { label: "Low Stock", value: data?.todo.lowStock, href: "/seller/inventory?stock=low_stock", icon: AlertTriangle },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back{data?.storeName ? `, ${data.storeName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage and grow your business with KTMONA</p>
      </div>

      {policy ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <Megaphone className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-foreground">
            <span className="font-semibold text-amber-700 dark:text-amber-300">{policy.title}:</span> {policy.body}
          </p>
          {policy.linkUrl ? (
            <a href={policy.linkUrl} className="text-sm font-semibold text-ink underline-offset-2 hover:underline dark:text-brand">
              {policy.linkLabel ?? "Know more"}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-brand" /> To do list
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {todo.map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  className="group flex items-center gap-3 rounded-xl border border-border-soft p-3 transition-colors hover:border-brand/50 hover:bg-mist/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand-strong">
                    <t.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs leading-tight text-muted-foreground">{t.label}</span>
                    <span className="flex items-center gap-1 text-lg font-semibold tabular-nums text-foreground">
                      {t.value ?? "–"}
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel
            title="Business Insights"
            action={
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as Range)}
                aria-label="Insights range"
                className="h-9 rounded-lg border border-border-soft bg-card px-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            }
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="h-60">{data ? <InsightsChart data={data.insights.series} metric={metric} /> : <div className="h-full animate-pulse rounded-xl bg-mist" />}</div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                {(["views", "orders"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetric(m)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      metric === m ? "border-brand bg-brand/5" : "border-border-soft hover:bg-mist/60"
                    )}
                  >
                    <span className="block text-xs text-muted-foreground">
                      {m === "views" ? "Views" : "Orders"} {lastLabel ? `(${lastLabel})` : ""}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-foreground">
                      {data?.insights[m].value ?? "–"}
                      <ChangePill value={data?.insights[m].change ?? null} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Link href="/seller/performance" className="mt-4 inline-block">
              <Btn variant="outline">View More Details</Btn>
            </Link>
          </Panel>

          <RtoCard rates={data?.rto} />
        </div>

        <div className="flex flex-col gap-5">
          {data && data.setup.length > 0 ? (
            <Panel title="Complete your account setup">
              <p className="-mt-1 mb-3 text-xs text-muted-foreground">Add the below information to improve your selling journey</p>
              <ul className="space-y-1">
                {data.setup
                  .filter((s) => !s.done)
                  .map((s) => (
                    <li key={s.key}>
                      <Link href={s.href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-ink hover:bg-mist dark:text-brand">
                        <KeyRound className="h-4 w-4" /> {s.label}
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Reduce prices to boost orders">
            {data && data.priceSuggestions > 0 ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{data.priceSuggestions} product(s)</span> are priced above similar
                products. A small price cut can bring more orders.
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">No price suggestions for now</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Prices for your products are in line with competition. You can track their growth on the pricing tab.
                </p>
              </>
            )}
            <Link href="/seller/pricing" className="mt-4 block">
              <Btn variant="outline" className="w-full">
                Track Price Growth
              </Btn>
            </Link>
          </Panel>

          <Panel title="Important Announcements" padded={false}>
            {data?.announcements.length ? (
              <ul className="divide-y divide-border-soft">
                {data.announcements.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <a href={a.linkUrl ?? "/seller/notifications"} className="flex items-start gap-3 px-5 py-3 hover:bg-mist/50">
                      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{a.title}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">{a.body}</span>
                      </span>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">No announcements right now.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
