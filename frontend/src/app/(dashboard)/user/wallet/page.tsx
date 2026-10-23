"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/components/checkout/PriceBreakup";
import {
  getWallet,
  getWalletTransactions,
  type WalletSummary,
  type WalletTransaction,
} from "@/services/account";

const SOURCE_LABEL: Record<WalletTransaction["source"], string> = {
  CASHBACK: "Cashback",
  REFERRAL: "Referral reward",
  CHECKOUT: "Used on order",
  ORDER_REFUND: "Returned from cancelled order",
  EXPIRY: "Expired",
  ADMIN: "Adjustment",
};

function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function WalletPage() {
  const [summary, setSummary] = React.useState<WalletSummary | null>(null);
  const [rows, setRows] = React.useState<WalletTransaction[]>([]);
  const [page, setPage] = React.useState(1);
  const [more, setMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([getWallet(), getWalletTransactions(1)])
      .then(([s, t]) => {
        setSummary(s);
        setRows(t.transactions);
        setMore(t.transactions.length === 30);
      })
      .catch(() => toast.error("Unable to load your wallet"))
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    const next = page + 1;
    const t = await getWalletTransactions(next);
    setRows((r) => [...r, ...t.transactions]);
    setPage(next);
    setMore(t.transactions.length === 30);
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-brand-strong">My Account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Wallet & Cashback</h1>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-ink p-5 text-paper">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80"><Wallet className="h-4 w-4" /> Available</p>
            <p className="mt-1 text-3xl font-semibold">{formatInr(summary.available)}</p>
            <p className="mt-1 text-xs opacity-80">Use it at checkout for up to {summary.rules.maxUsePercent}% of an order.</p>
          </div>
          <div className="rounded-2xl border border-border-soft bg-card p-5">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Clock className="h-4 w-4" /> Pending</p>
            <p className="mt-1 text-2xl font-semibold">{formatInr(summary.pending)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Released {summary.rules.holdDays} days after delivery, if the order isn&apos;t returned.</p>
          </div>
          <div className="rounded-2xl border border-border-soft bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Expiring next</p>
            {summary.nextExpiry ? (
              <>
                <p className="mt-1 text-2xl font-semibold">{formatInr(summary.nextExpiry.amount)}</p>
                <p className="mt-1 text-xs text-muted-foreground">on {day(summary.nextExpiry.at)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Nothing expiring.</p>
            )}
          </div>
        </div>
      ) : null}

      {summary ? (
        <section className="rounded-2xl border border-border-soft bg-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">How cashback works</h2>
          <ul className="space-y-1 text-muted-foreground">
            {summary.rules.enabled ? <li>• Earn {summary.rules.cashbackPercent}% back on the items in every delivered order.</li> : null}
            <li>• It becomes usable {summary.rules.holdDays} days after delivery, once the return window has closed. Returned or cancelled orders earn nothing.</li>
            <li>• Each credit can be used for {summary.rules.expiryDays} days. Older credits are used first.</li>
            <li>• Cashback cannot be withdrawn or transferred. <Link href="/offers" className="underline">Offer terms</Link></li>
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border-soft bg-card">
        <h2 className="border-b border-border-soft px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">History</h2>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No wallet activity yet. Your cashback will appear here after your first delivery.</p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {rows.map((t) => {
              const credit = t.kind === "CREDIT";
              const status =
                t.status === "PENDING" ? `Pending · usable from ${day(t.availableAt)}` :
                t.status === "REVERSED" ? "Cancelled (order returned or cancelled)" :
                t.status === "AVAILABLE" && t.expiresAt ? `Expires ${day(t.expiresAt)}` : "";
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{SOURCE_LABEL[t.source]}</p>
                    <p className="text-xs text-muted-foreground">
                      {day(t.createdAt)}
                      {t.orderId ? <> · <Link href={`/user/orders/${t.orderId}`} className="underline">Order {t.orderId.slice(0, 8).toUpperCase()}</Link></> : null}
                      {status ? ` · ${status}` : ""}
                    </p>
                  </div>
                  <p className={`font-semibold ${t.status === "REVERSED" ? "text-muted-foreground line-through" : credit ? "text-emerald-700" : "text-foreground"}`}>
                    {credit ? "+" : "−"}{formatInr(t.amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {more ? <div className="p-4 text-center"><Button variant="outline" size="sm" onClick={() => void loadMore()}>Load more</Button></div> : null}
      </section>
    </div>
  );
}
