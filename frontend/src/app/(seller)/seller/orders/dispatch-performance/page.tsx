"use client";

import * as React from "react";
import useSWR from "swr";
import { AlarmClock, CheckCircle2, Clock, Gauge, PackageCheck, XCircle } from "lucide-react";
import { supplier } from "@/services/seller-supplier";
import { ErrorNote, Loading, PageHeader, PageShell, Panel, StatCard, errorMessage } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90];

function band(value: number | null, good: number, risk: number, higherIsBetter = true) {
  if (value === null) return "gray";
  const ok = higherIsBetter ? value >= good : value <= good;
  const bad = higherIsBetter ? value < risk : value > risk;
  return ok ? "green" : bad ? "red" : "amber";
}

const BAND_CLS: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-mist",
};

export default function DispatchPerformancePage() {
  const [days, setDays] = React.useState(30);
  const { data, error, isLoading, mutate } = useSWR(["seller-dispatch", days], () => supplier.dispatchPerformance(days), { keepPreviousData: true });

  const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${v}%`);

  return (
    <PageShell>
      <PageHeader
        title="Dispatch Performance"
        description={`Hand every order to the courier within ${data?.slaHours ?? 48} hours. On-time dispatch keeps your listings visible and avoids late-dispatch penalties.`}
        breadcrumb={{ label: "Orders", href: "/seller/orders" }}
        actions={
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period" className="h-10 rounded-lg border border-border-soft bg-card px-3 text-sm">
            {RANGES.map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
        }
      />

      {error && !data ? (
        <ErrorNote message={errorMessage(error, "We are having trouble showing this data at the moment.")} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading rows={4} />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Gauge} tone="green" label="On-time dispatch" value={pct(data.onTimeDispatchPct)} sub={`${data.shipped - data.lateDispatched} of ${data.shipped} shipped on time`} />
            <StatCard icon={AlarmClock} tone="red" label="Breached, not yet shipped" value={data.pendingBreached} sub="Ship these now" href="/seller/orders?tab=pending" />
            <StatCard icon={Clock} tone="blue" label="Avg. time to dispatch" value={data.avgDispatchHours === null ? "–" : `${data.avgDispatchHours}h`} sub={`${pct(data.within24hPct)} shipped within 24h`} />
            <StatCard icon={XCircle} tone="amber" label="Seller cancellations" value={pct(data.sellerCancellationPct)} sub={`of ${data.totalOrders} orders`} />
          </div>

          <Panel title="Dispatch health">
            <div className="space-y-5">
              {[
                { label: "On-time dispatch rate", value: data.onTimeDispatchPct, target: "95% or more", tone: band(data.onTimeDispatchPct, 95, 85) },
                { label: "Shipped within 24 hours (Next Day Dispatch)", value: data.within24hPct, target: "80% or more", tone: band(data.within24hPct, 80, 50) },
                { label: "Same-day dispatch", value: data.sameDayPct, target: "Higher is better", tone: band(data.sameDayPct, 50, 20) },
                { label: "Seller cancellation rate", value: data.sellerCancellationPct, target: "Below 2%", tone: band(data.sellerCancellationPct, 2, 5, false) },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{m.label}</span>
                    <span className="tabular-nums text-foreground">{pct(m.value)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist">
                    <div className={cn("h-full rounded-full", BAND_CLS[m.tone])} style={{ width: `${Math.min(100, m.value ?? 0)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Target: {m.target}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Weekly trend" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="bg-mist/60 text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Week of</th>
                    <th className="px-5 py-3 font-semibold">Orders shipped</th>
                    <th className="px-5 py-3 font-semibold">On-time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weekly.map((w) => (
                    <tr key={w.start} className="border-t border-border-soft">
                      <td className="px-5 py-3">{new Date(w.start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                      <td className="px-5 py-3 tabular-nums">{w.shipped}</td>
                      <td className="px-5 py-3">
                        {w.onTimePct === null ? (
                          <span className="text-muted-foreground">–</span>
                        ) : (
                          <span className={cn("inline-flex items-center gap-1 font-semibold", w.onTimePct >= 95 ? "text-emerald-600" : "text-amber-600")}>
                            {w.onTimePct >= 95 ? <CheckCircle2 className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                            {w.onTimePct}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </PageShell>
  );
}
