"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, Banknote, CheckCircle2, Gavel, IndianRupee, Landmark, MapPin, Package, PauseCircle, Star, XCircle } from "lucide-react";
import { adminCenter, type AdminSellerDetail } from "@/services/admin-center";
import { inr, inr2, fmtDate, shortId } from "@/services/seller-center";
import { Badge, Btn, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, Panel, StatCard, StatusBadge, errorMessage, inputCls } from "@/components/seller/kit";
import { cn } from "@/lib/utils";
import { ReasonDialog } from "@/components/admin/ReasonDialog";

type Dialog = null | "kyc-reject" | "suspend" | "hold" | "commission" | "penalty";

export default function AdminSellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: s, error, isLoading, mutate } = useSWR(["admin-seller", id], () => adminCenter.seller(id));
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [suspendDays, setSuspendDays] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<AdminSellerDetail | unknown>, message: string) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res && typeof res === "object" && "sellerCode" in res) mutate(res as AdminSellerDetail, { revalidate: false });
      else mutate();
      toast.success(message);
      setDialog(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (error && !s) return <div className="p-6"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>;
  if (isLoading || !s) return <Loading rows={8} />;

  const statusTone = s.status === "ACTIVE" ? "green" : s.status === "PENDING" ? "orange" : "red";

  return (
    <PageShell>
      <PageHeader
        breadcrumb={{ label: "Sellers", href: "/admin/sellers" }}
        title={s.store?.name ?? "Seller without a store name"}
        description={`${s.sellerCode} · ${s.email ?? ""}${s.phone ? ` · ${s.phone}` : ""} · joined ${fmtDate(s.joinedAt)}`}
        actions={
          <>
            <Badge tone={statusTone}>{s.status}</Badge>
            {s.status === "PENDING" ? <Btn variant="brand" loading={busy === "approve"} onClick={() => act("approve", () => adminCenter.setSellerStatus(s.id, "ACTIVE"), "Seller approved")}>Approve seller</Btn> : null}
            {s.status === "ACTIVE" ? <Btn variant="danger" onClick={() => setDialog("suspend")}>Suspend</Btn> : null}
            {s.status === "SUSPENDED" ? <Btn variant="brand" loading={busy === "reactivate"} onClick={() => act("reactivate", () => adminCenter.setSellerStatus(s.id, "ACTIVE", "Reactivated by admin"), "Seller reactivated")}>Reactivate</Btn> : null}
          </>
        }
      />

      {s.statusReason && s.status === "SUSPENDED" ? (
        <div className="flex gap-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" />Suspended: {s.statusReason}. All listings are hidden.{s.suspendedUntil ? ` Lifts automatically on ${fmtDate(s.suspendedUntil, true)}.` : " Stays until you reactivate."}</div>
      ) : null}
      {s.payoutHold ? (
        <div className="flex gap-2 rounded-xl border border-brand/30 bg-brand/8 p-3 text-sm text-brand-strong"><PauseCircle className="h-4 w-4" />Payouts on hold: {s.payoutHoldReason}</div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} tone="blue" label="Lifetime GMV" value={inr.format(s.lifetime.gmv)} sub={`${s.lifetime.orders} orders`} />
        <StatCard icon={Package} tone="navy" label="Products" value={s.products.APPROVED ?? 0} sub={`${s.products.PENDING ?? 0} in QC · ${s.products.REJECTED ?? 0} rejected`} />
        <StatCard icon={Banknote} tone="green" label="Payout due" value={inr2.format(s.payoutDue.amount)} sub={`${s.payoutDue.settlements} orders · ${inr2.format(s.payoutDue.ledgerAmount)} adjustments`} />
        <StatCard icon={Star} tone="amber" label="Health score" value={`${s.health.score}/100`} sub={<StatusBadge status={s.health.status} />} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="KYC & business"
          action={s.kyc ? <StatusBadge status={s.kyc.status === "VERIFIED" ? "APPROVED" : s.kyc.status === "REJECTED" ? "REJECTED" : "PENDING"} /> : undefined}
        >
          {!s.kyc ? (
            <p className="text-sm text-muted-foreground">The seller has not submitted business details yet.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Type</dt><dd className="font-medium">{s.kyc.gstRegistered ? "GST registered" : "Non-GST"} · {s.kyc.businessType.replace(/_/g, " ").toLowerCase()}</dd>
                <dt className="text-muted-foreground">{s.kyc.gstRegistered ? "GSTIN" : "Enrolment ID"}</dt><dd className="font-mono font-medium">{s.kyc.gstRegistered ? s.kyc.gstin : s.kyc.enrolmentId}</dd>
                <dt className="text-muted-foreground">PAN</dt><dd className="font-mono font-medium">{s.kyc.pan ?? "—"}</dd>
                <dt className="text-muted-foreground">State</dt><dd className="font-medium">{s.kyc.state || "—"}</dd>
              </dl>
              {s.kyc.gstRegistered ? (
                <p className={cn("flex items-center gap-1 text-xs font-medium", s.kyc.panMatchesGstin ? "text-emerald-600" : "text-red-600")}>
                  {s.kyc.panMatchesGstin ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {s.kyc.panMatchesGstin ? "PAN matches the GSTIN" : "PAN does not match the GSTIN"}
                </p>
              ) : null}
              {s.kyc.rejectionReason ? <p className="text-xs text-red-600">Rejected: {s.kyc.rejectionReason}</p> : null}
              {s.kyc.verifiedAt ? <p className="text-xs text-muted-foreground">Verified {fmtDate(s.kyc.verifiedAt)}</p> : null}
              <div className="flex gap-2 pt-1">
                <Btn size="sm" variant="primary" disabled={s.kyc.status === "VERIFIED"} loading={busy === "kyc"} onClick={() => act("kyc", () => adminCenter.reviewKyc(s.id, "VERIFIED"), "KYC verified")}>
                  <BadgeCheck className="h-4 w-4" /> Verify KYC
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => setDialog("kyc-reject")}>Reject</Btn>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Bank & payouts" action={<Btn size="sm" variant="outline" onClick={() => setDialog("hold")}>{s.payoutHold ? "Release hold" : "Hold payouts"}</Btn>}>
          {s.bankAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bank account added. Payouts cannot be sent.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {s.bankAccounts.map((b) => (
                <li key={b.id} className="flex items-start gap-3">
                  <Landmark className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{b.bankName} · {b.accountNumberMasked} · {b.ifsc}</p>
                    <p className="text-xs text-muted-foreground">{b.holderName}</p>
                    {!b.holderMatchesStore ? <p className="text-xs text-brand-strong">Account holder differs from the store name; check before paying.</p> : null}
                  </div>
                  {b.isPrimary ? <Badge tone="green">Primary</Badge> : null}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-border-soft pt-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Recent payouts</p>
            {s.payouts.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
              <ul className="space-y-1 text-sm">
                {s.payouts.map((p) => (
                  <li key={p.id} className="flex justify-between"><span>{p.payoutNumber} · {fmtDate(p.createdAt)} · {p.reference}</span><b>{inr2.format(p.amount)}</b></li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Commission" action={<Btn size="sm" variant="outline" onClick={() => setDialog("commission")}>Change</Btn>}>
          <p className="text-2xl font-semibold">{s.commission.commissionPct}%{s.commission.platformFee ? <span className="text-base font-medium text-muted-foreground"> + {inr.format(s.commission.platformFee)} per order</span> : null}</p>
          <p className="text-sm text-muted-foreground">{s.commission.custom ? "Custom rate for this seller" : "Platform default rate"}</p>
        </Panel>

        <Panel title="Pickup address">
          {s.pickup?.pincode ? (
            <p className="flex gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />{[s.pickup.contactName, s.pickup.line1, s.pickup.line2, s.pickup.city, s.pickup.state, s.pickup.pincode].filter(Boolean).join(", ")} · {s.pickup.phone}</p>
          ) : <p className="text-sm text-muted-foreground">Not added.</p>}
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Account health (30 days)" padded={false}>
          <ul className="divide-y divide-border-soft">
            {s.health.metrics.map((m) => (
              <li key={m.key} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex-1">{m.label}</span>
                <span className="w-16 text-right font-semibold tabular-nums">{m.value === null ? "—" : `${m.value}${m.unit === "%" ? "%" : " ★"}`}</span>
                <span className="w-20 text-right"><StatusBadge status={m.status} /></span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Penalties" action={<Btn size="sm" variant="outline" onClick={() => setDialog("penalty")}><Gavel className="h-4 w-4" /> Add penalty / credit</Btn>}>
          {s.penalties.length === 0 ? <p className="text-sm text-muted-foreground">No penalties.</p> : (
            <ul className="divide-y divide-border-soft text-sm">
              {s.penalties.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span>{p.note} <span className="text-xs text-muted-foreground">· {fmtDate(p.createdAt)}</span>{p.waivedAt ? <Badge tone="gray" className="ml-2">Waived</Badge> : null}</span>
                  <b className="text-red-600">{inr2.format(p.amount)}</b>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <Panel title="Recent orders" padded={false}>
        {s.recentOrders.length === 0 ? <p className="px-5 py-4 text-sm text-muted-foreground">No orders yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground"><th className="px-5 py-3 font-semibold">Order</th><th className="px-3 py-3 font-semibold">Product</th><th className="px-3 py-3 font-semibold">Amount</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Dispatch by</th></tr></thead>
              <tbody>
                {s.recentOrders.map((o) => (
                  <tr key={o.orderId} className="border-b border-border-soft last:border-0">
                    <td className="px-5 py-3 font-semibold">{shortId(o.orderId)}<p className="text-xs font-normal text-muted-foreground">{fmtDate(o.orderDate)}</p></td>
                    <td className="max-w-[220px] truncate px-3 py-3">{o.items[0]?.title}</td>
                    <td className="px-3 py-3 tabular-nums">{inr.format(o.sellerAmount)}</td>
                    <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                    <td className={cn("px-5 py-3 text-xs", o.slaBreached && "font-semibold text-red-600")}>{fmtDate(o.dispatchBy)}{o.slaBreached ? " · overdue" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ReasonDialog
        open={dialog === "kyc-reject"}
        title="Reject KYC"
        label="Reason (shown to the seller)"
        presets={["GSTIN is invalid or inactive", "PAN does not match the GSTIN", "Bank account holder name does not match", "Documents unclear, please re-upload"]}
        confirm="Reject KYC"
        busy={busy === "kyc"}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => act("kyc", () => adminCenter.reviewKyc(s.id, "REJECTED", reason), "KYC rejected")}
      />
      <ReasonDialog
        open={dialog === "suspend"}
        title="Suspend seller"
        label="Reason"
        presets={["High cancellation rate", "Repeated late dispatch", "Counterfeit or prohibited products", "Customer complaints / fraud", "KYC failed"]}
        confirm="Suspend & hide listings"
        busy={busy === "suspend"}
        onClose={() => setDialog(null)}
        onConfirm={(reason) =>
          act(
            "suspend",
            () => adminCenter.setSellerStatus(s.id, "SUSPENDED", reason, suspendDays || undefined),
            suspendDays
              ? `Seller suspended for ${suspendDays} day${suspendDays === 1 ? "" : "s"}. Listings hidden and the seller is signed out.`
              : "Seller suspended until you reactivate. Listings hidden and the seller is signed out."
          )
        }
      >
        <Field label="How long?" hint="A temporary block lifts by itself. You can reactivate earlier at any time after reviewing.">
          <select className={inputCls} value={suspendDays} onChange={(e) => setSuspendDays(Number(e.target.value))}>
            <option value={0}>Until I review and reactivate</option>
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={15}>15 days</option>
            <option value={30}>30 days</option>
          </select>
        </Field>
      </ReasonDialog>
      <ReasonDialog
        open={dialog === "hold" && !s.payoutHold}
        title="Hold payouts"
        label="Reason"
        presets={["Investigating returns / claims", "KYC not verified", "Bank details mismatch", "Suspected fraud"]}
        confirm="Hold payouts"
        busy={busy === "hold"}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => act("hold", () => adminCenter.setPayoutHold(s.id, true, reason), "Payouts on hold")}
      />
      <Modal
        open={dialog === "hold" && s.payoutHold}
        onClose={() => setDialog(null)}
        title="Release payout hold?"
        footer={<><Btn variant="outline" onClick={() => setDialog(null)}>Cancel</Btn><Btn variant="primary" loading={busy === "hold"} onClick={() => act("hold", () => adminCenter.setPayoutHold(s.id, false), "Payout hold released")}>Release</Btn></>}
      >
        <p className="text-sm">The seller&apos;s due balance will be included in the next payout run.</p>
      </Modal>
      <CommissionDialog open={dialog === "commission"} current={s.commission} busy={busy === "commission"} onClose={() => setDialog(null)} onSave={(pct, fee) => act("commission", () => adminCenter.setCommission(s.id, pct, fee), "Commission updated")} />
      <PenaltyDialog open={dialog === "penalty"} busy={busy === "penalty"} onClose={() => setDialog(null)} onSave={(body) => act("penalty", () => adminCenter.addPenalty({ sellerId: s.id, ...body }), body.type === "PENALTY" ? "Penalty added" : "Credit added")} />
    </PageShell>
  );
}

function CommissionDialog({ open, current, busy, onClose, onSave }: { open: boolean; current: { commissionPct: number; platformFee: number }; busy: boolean; onClose: () => void; onSave: (pct: number, fee: number) => void }) {
  const [pct, setPct] = React.useState(String(current.commissionPct));
  const [fee, setFee] = React.useState(String(current.platformFee));
  React.useEffect(() => { setPct(String(current.commissionPct)); setFee(String(current.platformFee)); }, [open, current]);
  return (
    <Modal open={open} onClose={onClose} title="Seller commission" footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="primary" loading={busy} onClick={() => onSave(Number(pct), Number(fee))}>Save</Btn></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Commission (%)" hint="0–60%. Applies to new orders."><input type="number" min={0} max={60} step="0.5" className={inputCls} value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
        <Field label="Platform fee per order (₹)"><input type="number" min={0} className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function PenaltyDialog({ open, busy, onClose, onSave }: { open: boolean; busy: boolean; onClose: () => void; onSave: (body: { amount: number; note: string; orderId?: string; type: "PENALTY" | "ADJUSTMENT" }) => void }) {
  const [type, setType] = React.useState<"PENALTY" | "ADJUSTMENT">("PENALTY");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [orderId, setOrderId] = React.useState("");
  React.useEffect(() => { setAmount(""); setNote(""); setOrderId(""); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Add penalty or credit" footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="primary" loading={busy} disabled={!(Number(amount) > 0) || note.trim().length < 3} onClick={() => onSave({ type, amount: Number(amount), note: note.trim(), ...(orderId.trim() ? { orderId: orderId.trim() } : {}) })}>Save</Btn></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["PENALTY", "ADJUSTMENT"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={cn("rounded-xl border p-3 text-left text-sm", type === t ? "border-brand bg-brand/6" : "border-border-soft")}>
              <b>{t === "PENALTY" ? "Penalty" : "Credit"}</b>
              <p className="text-xs text-muted-foreground">{t === "PENALTY" ? "Deducted from the next payout" : "Added to the next payout"}</p>
            </button>
          ))}
        </div>
        <Field label="Amount (₹)"><input type="number" min={1} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Reason (shown to the seller)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Wrong product shipped" /></Field>
        <Field label="Order ID (optional)"><input className={inputCls} value={orderId} onChange={(e) => setOrderId(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

