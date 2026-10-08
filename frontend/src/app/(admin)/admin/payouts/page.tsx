"use client";

import * as React from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Banknote, Download, Landmark, PauseCircle, Wallet } from "lucide-react";
import { adminCenter, type DueSeller } from "@/services/admin-center";
import { inr2, fmtDate } from "@/services/seller-center";
import { Badge, Btn, Empty, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, Pager, StatCard, Tabs, errorMessage, inputCls } from "@/components/seller/kit";

type View = "due" | "history";

export default function PayoutsPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const [view, setView] = React.useState<View>("due");
  const [page, setPage] = React.useState(1);
  const { data: due, error, isLoading, mutate } = useSWR("admin-payouts-due", () => adminCenter.payoutsDue());
  const { data: hist } = useSWR(view === "history" ? ["admin-payouts", page] : null, () => adminCenter.payouts({ page }), { keepPreviousData: true });
  const [paying, setPaying] = React.useState<DueSeller | null>(null);

  const STATUS: Record<DueSeller["status"], [Parameters<typeof Badge>[0]["tone"], string]> = {
    PAYABLE: ["green", "Ready to pay"],
    ON_HOLD: ["red", "On hold"],
    NO_BANK: ["orange", "No bank account"],
    CARRY_FORWARD: ["gray", "Carry forward"],
  };

  return (
    <PageShell>
      <PageHeader
        title="Payouts"
        description={`Sellers are paid ${due?.paymentCycleDays ?? 7} days after delivery. Each payout includes their due orders minus ads spend and penalties, plus approved claims.`}
        actions={<Btn variant="outline" onClick={() => adminCenter.downloadBankFile().catch((e) => toast.error(errorMessage(e)))}><Download className="h-4 w-4" /> Bank transfer file</Btn>}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} tone="green" label="Payable now" value={due ? inr2.format(due.totals.payableAmount) : "—"} sub={due ? `${due.totals.payableSellers} seller(s)` : undefined} />
        <StatCard icon={PauseCircle} tone="red" label="On hold" value={due ? inr2.format(due.totals.onHoldAmount) : "—"} />
        <StatCard icon={Landmark} tone="orange" label="Missing bank details" value={due?.totals.missingBank ?? "—"} />
        <StatCard icon={Wallet} tone="navy" label="Negative balances" value={due?.totals.negativeBalances ?? "—"} sub="Carried to the next cycle" />
      </section>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2"><Tabs tabs={[{ key: "due", label: "Due now" }, { key: "history", label: "Payout history" }]} value={view} onChange={(v) => { setView(v); setPage(1); }} /></div>
        {view === "due" ? (
          error && !due ? (
            <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
          ) : isLoading && !due ? (
            <Loading />
          ) : !due || due.sellers.length === 0 ? (
            <Empty icon={Banknote} title="Nothing to pay" text="Orders become payable 7 days after delivery." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead><tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground"><th className="px-4 py-3 font-semibold">Seller</th><th className="px-3 py-3 font-semibold">Orders</th><th className="px-3 py-3 font-semibold">Order payouts</th><th className="px-3 py-3 font-semibold">Ads / penalties / claims</th><th className="px-3 py-3 font-semibold">To pay</th><th className="px-3 py-3 font-semibold">Bank</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold" /></tr></thead>
                <tbody>
                  {due.sellers.map((d) => {
                    const [tone, label] = STATUS[d.status];
                    return (
                      <tr key={d.sellerId} className="border-b border-border-soft last:border-0">
                        <td className="px-4 py-3"><Link href={`/admin/sellers/${d.sellerId}`} className="font-semibold hover:text-brand-strong">{d.storeName ?? d.sellerCode}</Link><p className="text-xs text-muted-foreground">{d.sellerCode}{d.oldestDueDate ? ` · due since ${fmtDate(d.oldestDueDate)}` : ""}</p></td>
                        <td className="px-3 py-3 tabular-nums">{d.settlementIds.length}</td>
                        <td className="px-3 py-3 tabular-nums">{inr2.format(d.settlementsAmount)}</td>
                        <td className={`px-3 py-3 tabular-nums ${d.ledgerAmount < 0 ? "text-red-600" : d.ledgerAmount > 0 ? "text-emerald-600" : ""}`}>{inr2.format(d.ledgerAmount)}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums">{inr2.format(d.amount)}</td>
                        <td className="px-3 py-3 text-xs">{d.bank ? <>{d.bank.bankName}<br /><span className="text-muted-foreground">{d.bank.accountNumber} · {d.bank.ifsc}</span></> : "—"}</td>
                        <td className="px-3 py-3"><Badge tone={tone}>{label}</Badge>{d.holdReason ? <p className="mt-1 max-w-[160px] text-xs text-muted-foreground">{d.holdReason}</p> : null}</td>
                        <td className="px-4 py-3 text-right">{d.status === "PAYABLE" ? <Btn size="sm" variant="brand" onClick={() => setPaying(d)}>Mark paid</Btn> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : !hist ? (
          <Loading />
        ) : hist.payouts.length === 0 ? (
          <Empty icon={Wallet} title="No payouts yet" />
        ) : (
          <>
            <p className="px-5 pt-3 text-sm text-muted-foreground">Total paid: <b className="text-foreground">{inr2.format(hist.totalPaid)}</b></p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead><tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground"><th className="px-4 py-3 font-semibold">Payout</th><th className="px-3 py-3 font-semibold">Seller</th><th className="px-3 py-3 font-semibold">Orders</th><th className="px-3 py-3 font-semibold">Adjustments</th><th className="px-3 py-3 font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Reference</th></tr></thead>
                <tbody>
                  {hist.payouts.map((p) => (
                    <tr key={p.id} className="border-b border-border-soft last:border-0">
                      <td className="px-4 py-3"><p className="font-semibold">{p.payoutNumber}</p><p className="text-xs text-muted-foreground">{fmtDate(p.createdAt, true)}</p></td>
                      <td className="px-3 py-3"><Link href={`/admin/sellers/${p.sellerId}`} className="hover:text-brand-strong">{p.storeName ?? "Seller"}</Link></td>
                      <td className="px-3 py-3 tabular-nums">{p.settlementCount} · {inr2.format(p.settlementsAmount)}</td>
                      <td className="px-3 py-3 tabular-nums">{inr2.format(p.ledgerAmount)}</td>
                      <td className="px-3 py-3 font-semibold tabular-nums">{inr2.format(p.amount)}</td>
                      <td className="px-4 py-3 text-xs">{p.method.replace("_", " ").toLowerCase()} · <span className="font-mono">{p.reference}</span>{p.note ? <p className="text-muted-foreground">{p.note}</p> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={hist.pagination.totalPages} onPage={setPage} />
          </>
        )}
      </div>
      <PayModal
        seller={paying}
        onClose={() => setPaying(null)}
        onPaid={() => { mutate(); globalMutate((k) => Array.isArray(k) && (k[0] === "admin-payouts" || k[0] === "admin-dashboard")); }}
      />
    </PageShell>
  );
}

function PayModal({ seller, onClose, onPaid }: { seller: DueSeller | null; onClose: () => void; onPaid: () => void }) {
  const [reference, setReference] = React.useState("");
  const [method, setMethod] = React.useState<"BANK_TRANSFER" | "UPI" | "OTHER">("BANK_TRANSFER");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { setReference(""); setNote(""); setMethod("BANK_TRANSFER"); }, [seller]);
  if (!seller) return null;
  const submit = async () => {
    setSaving(true);
    try {
      const res = await adminCenter.pay(seller.sellerId, { reference, method, note: note || undefined, expectedAmount: seller.amount });
      toast.success(`${res.payoutNumber} recorded`);
      onPaid();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Pay ${seller.storeName ?? seller.sellerCode}`} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="brand" loading={saving} disabled={reference.trim().length < 4} onClick={submit}>Confirm payout</Btn></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-mist p-4 text-sm">
          <p className="text-2xl font-semibold">{inr2.format(seller.amount)}</p>
          <p className="text-muted-foreground">{seller.settlementIds.length} order(s) {inr2.format(seller.settlementsAmount)} · adjustments {inr2.format(seller.ledgerAmount)}</p>
          {seller.bank ? <p className="mt-2">To {seller.bank.holderName} · {seller.bank.bankName} {seller.bank.accountNumber} · {seller.bank.ifsc}</p> : null}
        </div>
        <p className="text-xs text-muted-foreground">Transfer the amount from your bank first, then record the UTR here. This marks the orders as paid for the seller.</p>
        <Field label="Method">
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="BANK_TRANSFER">Bank transfer (NEFT/IMPS/RTGS)</option>
            <option value="UPI">UPI</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="UTR / transaction reference"><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label="Note (optional)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
