"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Clock, Download, IndianRupee, Wallet } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sellerCenter, inr, inr2, fmtDate, shortId } from "@/services/seller-center";
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
  StatCard,
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
  { key: "ledger", label: "Ads, claims & penalties" },
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
        description={`You are paid ${s?.paymentCycleDays ?? 7} days after each order is delivered, straight to your bank account. Ads spend and penalties are deducted; approved claims are added.`}
      />
      {sErr && !s ? <ErrorNote message={errorMessage(sErr)} onRetry={() => sMutate()} /> : null}
      {s?.payoutHold ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <b>Your payouts are on hold.</b> {s.payoutHold.reason ?? ""} Earnings keep adding up and will be paid once KTMONA releases the hold. Contact Seller Support for help.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarClock}
          tone="orange"
          label="Next payout"
          value={s ? inr.format(s.nextPayout.amount) : "—"}
          sub={s?.nextPayout.date ? `on ${fmtDate(s.nextPayout.date)}` : "No payout scheduled yet"}
        />
        <StatCard icon={Clock} tone="blue" label="Upcoming (delivered)" value={s ? inr.format(s.upcoming.amount) : "—"} sub={s ? `${s.upcoming.orders} orders` : undefined} />
        <StatCard icon={Wallet} tone="navy" label="In pipeline (not delivered)" value={s ? inr.format(s.outstanding.amount) : "—"} sub={s ? `${s.outstanding.orders} orders` : undefined} />
        <StatCard icon={CheckCircle2} tone="green" label="Total paid" value={s ? inr.format(s.paid.amount) : "—"} sub={s?.paid.lastPaidAt ? `Last paid ${fmtDate(s.paid.lastPaidAt)}` : undefined} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Weekly payouts">
          <div className="relative h-56">
            {s && s.weeklyPayouts.every((w) => w.amount === 0) ? (
              <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">No payouts in the last 6 weeks yet</p>
            ) : null}
            {s ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.weeklyPayouts.map((w) => ({ ...w, label: new Date(w.weekStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) }))}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip formatter={(v) => [inr.format(Number(v)), "Paid"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }} />
                  <Bar dataKey="amount" fill="var(--color-brand)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse rounded-xl bg-mist" />
            )}
          </div>
        </Panel>
        <Panel title="Settlement breakdown">
          {s ? (
            <dl className="space-y-2 text-sm">
              {[
                ["Gross sales (your price)", s.totals.gross],
                ["KTMONA commission", -s.totals.commission || 0],
                ["Platform fees", -s.totals.platformFee || 0],
                ["Ads spend (open)", s.ledger.adSpend],
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
              {ledgerNet !== 0 ? <p className="text-xs text-muted-foreground">Ads, penalties and claims are settled with your next payout.</p> : null}
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
            <Empty icon={IndianRupee} title="No adjustments" text="Ads spend, penalties and claim credits will appear here." />
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
