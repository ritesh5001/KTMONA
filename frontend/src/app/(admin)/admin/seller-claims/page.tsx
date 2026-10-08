"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { FileWarning } from "lucide-react";
import { adminSellerClaims, inr, fmtDate, shortId, type SellerClaim } from "@/services/seller-center";
import { Btn, Empty, ErrorNote, Field, Loading, Modal, PageHeader, PageShell, StatusBadge, Tabs, errorMessage, inputCls } from "@/components/seller/kit";

const TABS = [
  { key: "open", label: "Open" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const TYPE_LABEL: Record<string, string> = {
  DAMAGED_RETURN: "Damaged return",
  WRONG_RETURN: "Wrong product returned",
  MISSING_ITEM_IN_RETURN: "Item missing in return",
  RTO_DAMAGED: "RTO damaged",
  RTO_NOT_RECEIVED: "RTO not received",
  PAYMENT_ISSUE: "Payment issue",
  OTHER: "Other",
};

export default function AdminSellerClaimsPage() {
  const [tab, setTab] = React.useState("open");
  const { data, error, isLoading, mutate } = useSWR(["admin-seller-claims", tab], () => adminSellerClaims.list(tab), { keepPreviousData: true });
  const [reviewing, setReviewing] = React.useState<SellerClaim | null>(null);

  return (
    <PageShell>
      <PageHeader title="Seller claims" description="Sellers raise claims for damaged or wrong returns, lost RTO parcels and payment issues. Approved amounts are credited to their next payout." />
      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
        {error && !data ? (
          <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
        ) : isLoading && !data ? (
          <Loading />
        ) : !data || data.claims.length === 0 ? (
          <Empty icon={FileWarning} title="No claims" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-y border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Claim</th>
                  <th className="px-3 py-3 font-semibold">Seller</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Claimed</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {data.claims.map((c) => (
                  <tr key={c.id} className="border-b border-border-soft align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.claimNumber}</p>
                      <p className="text-xs text-muted-foreground">Order {shortId(c.orderId)} · {fmtDate(c.createdAt)}</p>
                    </td>
                    <td className="px-3 py-3">{c.storeName ?? c.sellerId?.slice(-6)}</td>
                    <td className="px-3 py-3">
                      <p>{TYPE_LABEL[c.type]}</p>
                      <p className="max-w-[280px] text-xs text-muted-foreground">{c.description}</p>
                      {c.images.length ? (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {c.images.map((u, i) => (
                            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-strong hover:underline">Evidence {i + 1}</a>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{c.amountClaimed != null ? inr.format(c.amountClaimed) : "—"}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={c.status} />
                      {c.amountApproved != null ? <p className="mt-1 text-xs text-emerald-600">{inr.format(c.amountApproved)} approved</p> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "OPEN" || c.status === "UNDER_REVIEW" ? <Btn size="sm" variant="primary" onClick={() => setReviewing(c)}>Review</Btn> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ReviewModal claim={reviewing} onClose={() => setReviewing(null)} onDone={() => mutate()} />
    </PageShell>
  );
}

function ReviewModal({ claim, onClose, onDone }: { claim: SellerClaim | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState<string | null>(null);
  React.useEffect(() => {
    setAmount(claim?.amountClaimed != null ? String(claim.amountClaimed) : "");
    setNote("");
  }, [claim]);
  if (!claim) return null;
  const act = async (status: "UNDER_REVIEW" | "APPROVED" | "REJECTED") => {
    setSaving(status);
    try {
      await adminSellerClaims.review(claim.id, { status, amountApproved: status === "APPROVED" ? Number(amount) : undefined, note: note || undefined });
      toast.success(status === "APPROVED" ? "Claim approved and credited" : status === "REJECTED" ? "Claim rejected" : "Marked under review");
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Review ${claim.claimNumber}`}
      footer={
        <>
          {claim.status === "OPEN" ? <Btn variant="outline" loading={saving === "UNDER_REVIEW"} onClick={() => act("UNDER_REVIEW")}>Mark under review</Btn> : null}
          <Btn variant="danger" loading={saving === "REJECTED"} onClick={() => act("REJECTED")}>Reject</Btn>
          <Btn variant="primary" loading={saving === "APPROVED"} disabled={!(Number(amount) >= 0)} onClick={() => act("APPROVED")}>Approve & credit</Btn>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p><b>{TYPE_LABEL[claim.type]}</b> · Order {shortId(claim.orderId)}</p>
        <p className="rounded-xl bg-mist p-3">{claim.description}</p>
        <Field label="Amount to credit (₹)" hint={`Seller claimed ${claim.amountClaimed != null ? inr.format(claim.amountClaimed) : "—"}`}>
          <input type="number" min={0} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Note to seller">
          <textarea rows={3} className={`${inputCls} h-auto py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
