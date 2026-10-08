"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { FileWarning, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { sellerCenter, inr, fmtDate, shortId, type ClaimType } from "@/services/seller-center";
import {
  Badge,
  Btn,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  PageShell,
  Pager,
  StatusBadge,
  Tabs,
  Thumb,
  errorMessage,
  inputCls,
} from "@/components/seller/kit";

type View = "returns" | "rto" | "claims";
const VIEWS: { key: View; label: string }[] = [
  { key: "returns", label: "Customer Returns" },
  { key: "rto", label: "RTO" },
  { key: "claims", label: "Claims" },
];

const CLAIM_LABELS: Record<ClaimType, string> = {
  DAMAGED_RETURN: "Returned product is damaged",
  WRONG_RETURN: "Wrong product returned",
  MISSING_ITEM_IN_RETURN: "Item missing in return",
  RTO_DAMAGED: "RTO parcel damaged",
  RTO_NOT_RECEIVED: "RTO parcel not received",
  PAYMENT_ISSUE: "Payment issue",
  OTHER: "Other",
};

type ClaimTarget = { orderId: string; returnId?: string; types: ClaimType[]; maxAmount: number };

export default function ReturnsPage() {
  const params = useSearchParams();
  const [view, setView] = React.useState<View>((VIEWS.find((v) => v.key === params.get("view"))?.key ?? "returns") as View);
  const [claimFor, setClaimFor] = React.useState<ClaimTarget | null>(null);

  return (
    <PageShell>
      <PageHeader
        title="Returns & Refunds"
        description="Track customer returns and RTO parcels, and raise a claim when a return comes back damaged, wrong or missing."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: RotateCcw, title: "Customer returns", text: "Approved returns are picked up and sent back to your pickup address." },
          { icon: Truck, title: "RTO", text: "Parcels the customer did not accept come back as Return to Origin." },
          { icon: ShieldCheck, title: "Seller protection", text: "Claim within 30 days of a return if the item is damaged or wrong." },
        ].map((c) => (
          <div key={c.title} className="flex gap-3 rounded-2xl border border-border-soft bg-card p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand-strong">
              <c.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs tabs={VIEWS} value={view} onChange={setView} />
        </div>
        {view === "returns" ? <ReturnsView onClaim={setClaimFor} /> : view === "rto" ? <RtoView onClaim={setClaimFor} /> : <ClaimsView />}
      </div>

      <ClaimModal target={claimFor} onClose={() => setClaimFor(null)} onDone={() => setView("claims")} />
    </PageShell>
  );
}

function ReturnsView({ onClaim }: { onClaim: (t: ClaimTarget) => void }) {
  const [tab, setTab] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const { data, error, isLoading, mutate } = useSWR(["seller-returns", tab, page], () => sellerCenter.returns({ tab, page }), { keepPreviousData: true });
  const tabs = ["all", "requested", "approved", "inspecting", "refunded", "rejected"].map((k) => ({ key: k, label: k[0]!.toUpperCase() + k.slice(1) }));
  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-border-soft px-4 py-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === t.key ? "bg-ink text-paper dark:bg-brand dark:text-ink" : "bg-mist text-muted-foreground hover:text-foreground"}`}
          >
            {t.label} {data?.counts[t.key] !== undefined ? `(${data.counts[t.key]})` : ""}
          </button>
        ))}
      </div>
      {error && !data ? (
        <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
      ) : isLoading && !data ? (
        <Loading />
      ) : !data || data.returns.length === 0 ? (
        <Empty icon={RotateCcw} title="No returns" text="Great news: no customer returns here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-3 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold">Reason</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Value</th>
                <th className="px-4 py-3 text-right font-semibold">Claim</th>
              </tr>
            </thead>
            <tbody>
              {data.returns.map((r) => (
                <tr key={r.id} className="border-b border-border-soft align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{shortId(r.orderId)}</p>
                    <p className="text-xs text-muted-foreground">Requested {fmtDate(r.requestedAt)}</p>
                  </td>
                  <td className="px-3 py-3">
                    {r.items.map((i, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <Thumb src={i.image} alt={i.title} />
                        <div>
                          <p className="max-w-[220px] truncate font-medium">{i.title}</p>
                          <p className="text-xs text-muted-foreground">Qty {i.quantity} · {[i.size, i.color].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">{r.reason}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.status} />
                    {r.rejectionReason ? <p className="mt-1 text-xs text-muted-foreground">{r.rejectionReason}</p> : null}
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums">{inr.format(r.sellerAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.claim ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">{r.claim.claimNumber}</p>
                        <StatusBadge status={r.claim.status} />
                      </div>
                    ) : r.canClaim ? (
                      <Btn size="sm" variant="outline" onClick={() => onClaim({ orderId: r.orderId, returnId: r.id, types: ["DAMAGED_RETURN", "WRONG_RETURN", "MISSING_ITEM_IN_RETURN"], maxAmount: r.sellerAmount })}>
                        Raise claim
                      </Btn>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}

function RtoView({ onClaim }: { onClaim: (t: ClaimTarget) => void }) {
  const [status, setStatus] = React.useState<"all" | "in_transit" | "received">("all");
  const [page, setPage] = React.useState(1);
  const { data, error, isLoading, mutate } = useSWR(["seller-rto", status, page], () => sellerCenter.rtoList({ status, page }), { keepPreviousData: true });
  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-border-soft px-4 py-3">
        {(["all", "in_transit", "received"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setStatus(k); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${status === k ? "bg-ink text-paper dark:bg-brand dark:text-ink" : "bg-mist text-muted-foreground hover:text-foreground"}`}
          >
            {k === "all" ? "All" : k === "in_transit" ? "In transit" : "Received"} {data ? `(${data.counts[k]})` : ""}
          </button>
        ))}
      </div>
      {error && !data ? (
        <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
      ) : isLoading && !data ? (
        <Loading />
      ) : !data || data.rto.length === 0 ? (
        <Empty icon={Truck} title="No RTO parcels" text="Parcels returned by the courier will show here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-3 py-3 font-semibold">Courier / AWB</th>
                <th className="px-3 py-3 font-semibold">Reason</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Value</th>
                <th className="px-4 py-3 text-right font-semibold">Claim</th>
              </tr>
            </thead>
            <tbody>
              {data.rto.map((r) => (
                <tr key={r.orderId} className="border-b border-border-soft last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{shortId(r.orderId)}</p>
                    <p className="text-xs text-muted-foreground">{r.customer.name} · {r.customer.city}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{r.carrier}<br />{r.awb ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.status} />
                    <p className="mt-1 text-xs text-muted-foreground">{fmtDate(r.receivedAt ?? r.initiatedAt)}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums">{inr.format(r.sellerAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.claim ? (
                      <div className="space-y-1"><p className="text-xs font-semibold">{r.claim.claimNumber}</p><StatusBadge status={r.claim.status} /></div>
                    ) : (
                      <Btn size="sm" variant="outline" onClick={() => onClaim({ orderId: r.orderId, types: ["RTO_DAMAGED", "RTO_NOT_RECEIVED"], maxAmount: r.sellerAmount })}>
                        Raise claim
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}

function ClaimsView() {
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const { data, error, isLoading, mutate } = useSWR(["seller-claims", status, page], () => sellerCenter.claims({ status, page }), { keepPreviousData: true });
  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-border-soft px-4 py-3">
        {["all", "open", "under_review", "approved", "rejected"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setStatus(k); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${status === k ? "bg-ink text-paper dark:bg-brand dark:text-ink" : "bg-mist text-muted-foreground hover:text-foreground"}`}
          >
            {k.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())} {data?.counts[k] !== undefined ? `(${data.counts[k]})` : ""}
          </button>
        ))}
      </div>
      {error && !data ? (
        <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>
      ) : isLoading && !data ? (
        <Loading />
      ) : !data || data.claims.length === 0 ? (
        <Empty icon={FileWarning} title="No claims" text="Raise a claim from a return or RTO when something is wrong." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Claim</th>
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 font-semibold">Claimed</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Resolution</th>
              </tr>
            </thead>
            <tbody>
              {data.claims.map((c) => (
                <tr key={c.id} className="border-b border-border-soft align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{c.claimNumber}</p>
                    <p className="text-xs text-muted-foreground">Order {shortId(c.orderId)} · {fmtDate(c.createdAt)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{CLAIM_LABELS[c.type]}</p>
                    <p className="max-w-[260px] truncate text-xs text-muted-foreground">{c.description}</p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{c.amountClaimed != null ? inr.format(c.amountClaimed) : "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.status === "APPROVED" && c.amountApproved != null ? <Badge tone="green">{inr.format(c.amountApproved)} credited</Badge> : null}
                    {c.resolutionNote ? <p className="mt-1">{c.resolutionNote}</p> : c.status === "OPEN" ? "Awaiting review (usually 3–5 days)" : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}

function ClaimModal({ target, onClose, onDone }: { target: ClaimTarget | null; onClose: () => void; onDone: () => void }) {
  const [type, setType] = React.useState<ClaimType>("DAMAGED_RETURN");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [images, setImages] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (target) {
      setType(target.types[0]!);
      setDescription("");
      setAmount(String(target.maxAmount));
      setImages("");
    }
  }, [target]);
  if (!target) return null;
  const submit = async () => {
    setSaving(true);
    try {
      const res = await sellerCenter.createClaim({
        orderId: target.orderId,
        returnId: target.returnId,
        type,
        description,
        amountClaimed: Number(amount) || undefined,
        images: images.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)),
      });
      toast.success(`Claim ${res.claimNumber} raised`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Raise a claim · ${shortId(target.orderId)}`}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} disabled={description.trim().length < 10} onClick={submit}>Submit claim</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What went wrong?">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as ClaimType)}>
            {target.types.map((t) => (
              <option key={t} value={t}>{CLAIM_LABELS[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Describe the problem" hint="At least 10 characters. Mention what you received and its condition.">
          <textarea rows={4} className={`${inputCls} h-auto py-2`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Amount claimed (₹)" hint={`Up to ${inr.format(target.maxAmount)} (the value of this order to you).`}>
          <input type="number" min={1} max={target.maxAmount} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Photo / video links (optional)" hint="Paste links to unboxing photos or video, separated by commas.">
          <input className={inputCls} value={images} onChange={(e) => setImages(e.target.value)} placeholder="https://…" />
        </Field>
      </div>
    </Modal>
  );
}
