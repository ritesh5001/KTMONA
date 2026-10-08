"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { AlarmClock, AlertTriangle, Timer, Zap } from "lucide-react";
import { adminCenter } from "@/services/admin-center";
import { inr, fmtDate, shortId } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Loading, PageHeader, PageShell, StatCard, errorMessage } from "@/components/seller/kit";
import { cn } from "@/lib/utils";

export default function SlaPage() {
  const { data, error, isLoading, mutate } = useSWR("admin-sla", () => adminCenter.sla(), { refreshInterval: 60_000 });
  const [running, setRunning] = React.useState(false);
  const rows = data?.rows ?? [];
  const sellers = new Set(rows.map((r) => r.sellerId)).size;
  const autoCancelOn = (data?.rules.autoCancelAfterHours ?? 0) > 0;

  const run = async () => {
    setRunning(true);
    try {
      const res = await adminCenter.runAutoCancel();
      toast.success(res.cancelled ? `${res.cancelled} order(s) auto-cancelled and refunded` : "Nothing to auto-cancel right now");
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Dispatch SLA"
        description="Sellers must hand orders to the courier within 48 hours. Orders past their dispatch date are listed here, oldest first."
        actions={
          <>
            <Link href="/admin/penalties"><Btn variant="outline">Penalty rules</Btn></Link>
            <Btn variant="primary" loading={running} disabled={!autoCancelOn} onClick={run}><Zap className="h-4 w-4" /> Run auto-cancel now</Btn>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={AlarmClock} tone="red" label="Orders past dispatch date" value={rows.length} />
        <StatCard icon={AlertTriangle} tone="orange" label="Sellers involved" value={sellers} />
        <StatCard
          icon={Timer}
          tone="navy"
          label="Auto-cancel"
          value={autoCancelOn ? `${data!.rules.autoCancelAfterHours}h after due` : "Off"}
          sub={autoCancelOn ? `Charge ${inr.format(data!.rules.autoCancelPenalty)} per order` : "Turn on in Penalty rules"}
        />
      </section>
      <div className="rounded-2xl border border-border-soft bg-card">
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading rows={5} />
        ) : rows.length === 0 ? (
          <Empty icon={AlarmClock} title="Every order is on time" text="No order is past its dispatch date." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Seller</th>
                  <th className="px-3 py-3 font-semibold">Stage</th>
                  <th className="px-3 py-3 font-semibold">Dispatch by</th>
                  <th className="px-3 py-3 font-semibold">Overdue</th>
                  <th className="px-3 py-3 font-semibold">Value</th>
                  <th className="px-4 py-3 font-semibold">Auto-cancel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.orderId}-${r.sellerId}`} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3"><p className="font-semibold">{shortId(r.orderId)}</p><p className="text-xs text-muted-foreground">{fmtDate(r.orderDate)}</p></td>
                    <td className="px-3 py-3"><Link href={`/admin/sellers/${r.sellerId}`} className="font-medium hover:text-brand-strong">{r.storeName ?? "Seller"}</Link></td>
                    <td className="px-3 py-3"><Badge tone={r.stage === "PENDING" ? "orange" : "blue"}>{r.stage === "PENDING" ? "Not accepted" : "Accepted, not shipped"}</Badge></td>
                    <td className="px-3 py-3">{fmtDate(r.dispatchBy)}</td>
                    <td className={cn("px-3 py-3 font-semibold tabular-nums", r.hoursOverdue >= 24 ? "text-red-600" : "text-brand-strong")}>{r.hoursOverdue}h</td>
                    <td className="px-3 py-3 tabular-nums">{inr.format(r.amount)}</td>
                    <td className="px-4 py-3">{r.willAutoCancel ? <Badge tone="red">Next run</Badge> : <span className="text-xs text-muted-foreground">{autoCancelOn ? `in ${Math.max(0, data!.rules.autoCancelAfterHours - r.hoursOverdue)}h` : "off"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
