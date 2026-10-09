"use client";

import { ADS_ENABLED } from "@/lib/features";
import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock, Download, IndianRupee, Truck, Wallet } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sellerCenter, inr, inr2, fmtDate, shortId } from "@/services/seller-center";
import { supplier } from "@/services/seller-supplier";
import {
  Btn,
  Empty,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  PageShell,
  Pager,
  Panel,
  SearchBox,
  StatusBadge,
  Tabs,
  errorMessage,
  inputCls,
  useDebounced,
} from "@/components/seller/kit";
import { cn } from "@/lib/utils";

type View = "upcoming" | "outstanding" | "paid" | "all" | "ledger";
const VIEWS: { key: View; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "outstanding", label: "In pipeline" },
  { key: "paid", label: "Paid" },
  { key: "all", label: "All orders" },
  { key: "ledger", label: ADS_ENABLED ? "Ads, claims & penalties" : "Claims & penalties" },
];

const LEDGER_LABEL = { AD_SPEND: "Ads spend", PENALTY: "Penalty", CLAIM_CREDIT: "Claim credit", ADJUSTMENT: "Adjustment" } as const;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function PaymentsPage() {
  const [view, setView] = React.useState<View>("upcoming");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [from, setFrom] = React.useState(isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = React.useState(isoDay(new Date()));
  const [downloading, setDownloading] = React.useState(false);

  const { data: s, error: sErr, mutate: sMutate } = useSWR("seller-payments-summary", () => sellerCenter.paymentsSummary());
  const { data: d } = useSWR("seller-payments-dashboard", () => supplier.paymentsDashboard());
  const { data: rows, isLoading } = useSWR(view !== "ledger" ? ["seller-payment-rows", view, page, q] : null, () =>
    sellerCenter.paymentOrders({ bucket: view === "all" ? undefined : view, page, search: q })
  , { keepPreviousData: true });
  const { data: ledger, isLoading: ledgerLoading } = useSWR(view === "ledger" ? ["seller-ledger", page] : null, () => sellerCenter.ledger({ page }), { keepPreviousData: true });

  const download = async () => {
    setDownloading(true);
    try {
      await sellerCenter.downloadStatement(from, to);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const ledgerNet = s ? s.ledger.adSpend + s.ledger.penalties + s.ledger.claimCredits + s.ledger.adjustments : 0;

  return (
    <PageShell>
      <PageHeader
        title="Payments"
        description={`You are paid ${s?.paymentCycleDays ?? 7} days after each order is delivered, straight to your bank account. ${ADS_ENABLED ? "Ads spend and penalties are" : "Penalties are"} deducted; approved claims are added.`}
      />
      {sErr && !s ? <ErrorNote message={errorMessage(sErr)} onRetry={() => sMutate()} /> : null}
      {s?.payoutHold ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <b>Your payouts are on hold.</b> {s.payoutHold.reason ?? ""} Earnings keep adding up and will be paid once KTMONA releases the hold. Contact Seller Support for help.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <PayCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          title="Upcoming Payments"
          badge={`Next 7 days (${inr2.format(d?.upcoming.next7Days ?? 0)})`}
          rows={d?.upcoming.payments ?? []}
          empty="No upcoming payments to show"
          emptyText="Your upcoming payouts will appear here once orders are delivered."
          onView={() => { setView("upcoming"); setPage(1); }}
        />
        <PayCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          title="Completed Payments"
          badge={`Last 30 days (${inr2.format(d?.completed.last30Days ?? 0)})`}
          rows={d?.completed.payments ?? []}
          empty="No completed payments to show"
          emptyText="Once orders are delivered and payments cleared, payment information will appear here."
          onView={() => { setView("paid"); setPage(1); }}
        />
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-card p-4 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
          <Truck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Unscheduled Payments {d ? <span className="tabular-nums">· {inr2.format(d.unscheduled.amount)} ({d.unscheduled.orders} orders)</span> : null}</p>
          <p className="text-xs text-muted-foreground">Payments expected from your shipped orders. Once delivered, we will automatically move them to your upcoming payments.</p>
        </div>
        <Btn variant="outline" onClick={() => { setView("outstanding"); setPage(1); }}>View Details</Btn>
      </div>

      <Panel title="Payments over time">
        <div className="relative h-56">
          {d && d.series.every((x) => x.paid === 0 && x.outstanding === 0) ? (
            <p className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <b className="text-foreground">No Trend to Show</b>
              There is not enough data in the selected timeframe.
            </p>
          ) : null}
          {d ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.series.map((x) => ({ ...x, label: new Date(x.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) }))}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={4} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  formatter={(v, name) => [inr.format(Number(v)), name === "paid" ? "Payments to date" : "Outstanding payment"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
                />
                <Bar dataKey="paid" stackId="a" fill="var(--color-brand)" />
                <Bar dataKey="outstanding" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full animate-pulse rounded-xl bg-mist" />
          )}
        </div>
        <p className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand" /> Payments to Date</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#94a3b8]" /> Outstanding Payment</span>
          <span>Daily view of the last 30 days</span>
        </p>
      </Panel>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
        <Panel title="Compensation & Recoveries" action={<button type="button" className="text-xs font-semibold text-ink hover:underline dark:text-brand" onClick={() => { setView("ledger"); setPage(1); }}>View Details</button>}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Compensations</dt><dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{inr2.format(d?.compensation.compensation ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Recoveries</dt><dd className="font-semibold tabular-nums text-red-600">{inr2.format(d?.compensation.recoveries ?? 0)}</dd></div>
            <div className="flex justify-between border-t border-border-soft pt-2"><dt className="font-semibold">Total</dt><dd className="font-semibold tabular-nums">{inr2.format(d?.compensation.total ?? 0)}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">Last 30 days</p>
        </Panel>
        {ADS_ENABLED ? (
          <Panel title="Ads Cost">
            {d && d.adsCost.last30Days > 0 ? (
              <p className="text-2xl font-semibold tabular-nums">{inr2.format(d.adsCost.last30Days)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">You have not spent on Ads in the last 30 days.</p>
            )}
          </Panel>
        ) : (
          <Panel title="Have a query?">
            <p className="text-sm text-muted-foreground">Raise a ticket for your payment related matters.</p>
            <Link href="/seller/support?topic=payments" className="mt-3 inline-block">
              <Btn variant="outline">Raise a ticket</Btn>
            </Link>
          </Panel>
        )}
        <Panel title="Settlement breakdown">
          {s ? (
            <dl className="space-y-2 text-sm">
              {[
                ["Gross sales (your price)", s.totals.gross],
                ["KTMONA commission", -s.totals.commission || 0],
                ["Platform fees", -s.totals.platformFee || 0],
                ...(ADS_ENABLED || s.ledger.adSpend !== 0 ? [["Ads spend (open)", s.ledger.adSpend] as [string, number]] : []),
                ["Penalties (open)", s.ledger.penalties],
                ["Claim credits (open)", s.ledger.claimCredits],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn("font-semibold tabular-nums", (value as number) < 0 && "text-red-600")}>{inr2.format(value as number)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-border-soft pt-2 text-base">
                <dt className="font-semibold">Net payable now</dt>
                <dd className="font-semibold tabular-nums">{inr2.format(s.netPayable)}</dd>
              </div>
              {ledgerNet !== 0 ? <p className="text-xs text-muted-foreground">{ADS_ENABLED ? "Ads, penalties" : "Penalties"} and claims are settled with your next payout.</p> : null}
            </dl>
          ) : (
            <Loading rows={3} />
          )}
        </Panel>
      </section>

      <Panel title="Download statement">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="From">
            <input type="date" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Btn variant="primary" loading={downloading} onClick={download}>
            <Download className="h-4 w-4" /> Download CSV
          </Btn>
        </div>
      </Panel>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="flex flex-col gap-3 px-4 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <Tabs tabs={VIEWS} value={view} onChange={(v) => { setView(v); setPage(1); }} />
          {view !== "ledger" ? (
            <div className="pb-3">
              <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search order ID" />
            </div>
          ) : null}
        </div>

        {view === "ledger" ? (
          ledgerLoading && !ledger ? (
            <Loading />
          ) : !ledger || ledger.entries.length === 0 ? (
            <Empty icon={IndianRupee} title="No adjustments" text={ADS_ENABLED ? "Ads spend, penalties and claim credits will appear here." : "Penalties and claim credits will appear here."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Type</th>
                    <th className="px-3 py-3 font-semibold">Details</th>
                    <th className="px-3 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.entries.map((e) => (
                    <tr key={e.id} className="border-b border-border-soft last:border-0">
                      <td className="px-4 py-3">{fmtDate(e.entryDate)}</td>
                      <td className="px-3 py-3">{LEDGER_LABEL[e.type]}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.note ?? "—"}{e.orderId ? ` · ${shortId(e.orderId)}` : ""}</td>
                      <td className={cn("px-3 py-3 font-semibold tabular-nums", e.amount < 0 ? "text-red-600" : "text-emerald-600")}>{inr2.format(e.amount)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.settledAt ? fmtDate(e.settledAt) : "With next payout"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : isLoading && !rows ? (
          <Loading />
        ) : !rows || rows.rows.length === 0 ? (
          <Empty icon={Wallet} title="Nothing here yet" text="Order payouts will appear here once customers pay." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Your price</th>
                  <th className="px-3 py-3 font-semibold">Commission</th>
                  <th className="px-3 py-3 font-semibold">Fee</th>
                  <th className="px-3 py-3 font-semibold">You get</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Payout date</th>
                </tr>
              </thead>
              <tbody>
                {rows.rows.map((r) => (
                  <tr key={r.settlementId} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{shortId(r.orderId)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(r.orderDate)}</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{inr2.format(r.gross)}</td>
                    <td className="px-3 py-3 tabular-nums text-red-600">−{inr2.format(r.commission)}</td>
                    <td className="px-3 py-3 tabular-nums text-red-600">{r.platformFee ? `−${inr2.format(r.platformFee)}` : "—"}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums">{inr2.format(r.net)}</td>
                    <td className="px-3 py-3"><StatusBadge status={r.bucket} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.paidAt ? `Paid ${fmtDate(r.paidAt)}` : r.payableOn ? fmtDate(r.payableOn) : r.bucket === "outstanding" ? "7 days after delivery" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} totalPages={(view === "ledger" ? ledger?.pagination.totalPages : rows?.pagination.totalPages) ?? 1} onPage={setPage} />
      </div>
    </PageShell>
  );
}

function PayCard({
  icon,
  title,
  badge,
  rows,
  empty,
  emptyText,
  onView,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  rows: { date: string; amount: number; orders: number }[];
  empty: string;
  emptyText: string;
  onView: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border-soft bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {icon} {title}
        </h2>
        <button type="button" onClick={onView} className="inline-flex items-center gap-1 rounded-lg border border-border-soft px-2.5 py-1 text-xs font-semibold hover:bg-mist">
          {badge} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <IndianRupee className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">{empty}</p>
          <p className="max-w-xs text-xs text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border-soft">
          {rows.map((r) => (
            <li key={r.date} className="flex items-center justify-between py-3 text-sm">
              <span>
                <span className="block font-medium">{fmtDate(r.date)}</span>
                <span className="text-xs text-muted-foreground">{r.orders} order(s)</span>
              </span>
              <span className="font-semibold tabular-nums">{inr2.format(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
