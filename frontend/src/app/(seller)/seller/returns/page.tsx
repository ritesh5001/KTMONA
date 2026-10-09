"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { FileWarning, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { sellerCenter, inr, fmtDate, shortId, type ClaimType } from "@/services/seller-center";
import { supplier } from "@/services/seller-supplier";
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

type View = "overview" | "tracking" | "claims";
const VIEWS: { key: View; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tracking", label: "Return Tracking" },
  { key: "claims", label: "Claim Tracking" },
];
type Tracking = "returns" | "rto";

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
  const legacy = params.get("view");
  const initial: View = legacy === "claims" ? "claims" : legacy === "returns" || legacy === "rto" ? "tracking" : ((VIEWS.find((v) => v.key === legacy)?.key ?? "overview") as View);
  const [view, setView] = React.useState<View>(initial);
  const [tracking, setTracking] = React.useState<Tracking>(legacy === "rto" ? "rto" : "returns");
  const [claimFor, setClaimFor] = React.useState<ClaimTarget | null>(null);

  return (
    <PageShell>
      <PageHeader
        title="Return/RTO Orders"
        description="Track customer returns and RTO parcels, and raise a claim when a return comes back damaged, wrong or missing."
        actions={
          <Link href="/seller/claims">
            <Btn variant="primary"><ShieldCheck className="h-4 w-4" /> Raise Claim</Btn>
          </Link>
        }
      />

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs tabs={VIEWS} value={view} onChange={setView} />
        </div>
        {view === "overview" ? (
          <OverviewView />
        ) : view === "tracking" ? (
          <>
            <div className="flex gap-2 px-4 pt-3">
              {([
                { key: "returns", label: "Customer Returns" },
                { key: "rto", label: "Courier Returns (RTO)" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTracking(t.key)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${tracking === t.key ? "border-brand bg-brand/10 text-foreground" : "border-border-soft text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tracking === "returns" ? <ReturnsView onClaim={setClaimFor} /> : <RtoView onClaim={setClaimFor} />}
          </>
        ) : (
          <ClaimsView />
        )}
      </div>

      <ClaimModal target={claimFor} onClose={() => setClaimFor(null)} onDone={() => setView("claims")} />
    </PageShell>
  );
}

function OverviewView() {
  const [days, setDays] = React.useState(30);
  const [sort, setSort] = React.useState("recent");
  const [performance, setPerformance] = React.useState("");
  const { data, error, isLoading, mutate } = useSWR(["seller-returns-overview", days, sort, performance], () => supplier.returnsOverview({ days, sort, performance }), {
    keepPreviousData: true,
  });
  if (error && !data) return <div className="p-4"><ErrorNote message={errorMessage(error)} onRetry={() => mutate()} /></div>;
  if (isLoading && !data) return <Loading />;
  if (!data) return null;
  const s = data.summary;
  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Summary</h3>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period" className="h-9 rounded-lg border border-border-soft bg-card px-2 text-sm">
          <option value={30}>Last 1 Month</option>
          <option value={90}>Last 3 Months</option>
          <option value={180}>Last 6 Months</option>
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border-soft p-4">
          <p className="text-xs font-medium text-muted-foreground">Customer Return Rate</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{s.returnRate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.returned} orders returned out of {s.delivered} delivered</p>
        </div>
        <div className="rounded-xl border border-border-soft p-4">
          <p className="text-xs font-medium text-muted-foreground">Average Reverse Shipping Cost</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{inr.format(s.avgReverseShippingCost)}</p>
          <p className="mt-1 text-xs text-muted-foreground">For {s.returned} customer returned orders</p>
        </div>
        <div className="rounded-xl border border-border-soft p-4">
          <p className="text-xs font-medium text-muted-foreground">Courier Return (RTO) Rate</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{s.rtoRate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.rtoOrders} RTO orders out of {s.dispatched} dispatched</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <ShieldCheck className="h-4 w-4 text-amber-600" />
        <span className="flex-1">Add a Wrong/Defective Returns Price and a prepaid discount to cut unwanted returns and RTO.</span>
        <Link href="/seller/pricing/reduce-rto" className="font-semibold text-ink hover:underline dark:text-brand">Reduce RTO &amp; Returns</Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Product Performance</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <select value={performance} onChange={(e) => setPerformance(e.target.value)} aria-label="Performance" className="h-9 rounded-lg border border-border-soft bg-card px-2">
            <option value="">Performance: All</option>
            <option value="high_returns">High returns (&gt;10%)</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className="h-9 rounded-lg border border-border-soft bg-card px-2">
            <option value="recent">Most Recent</option>
            <option value="returns">Highest Return Rate</option>
            <option value="orders">Most Delivered</option>
          </select>
        </div>
      </div>
      {data.products.length === 0 ? (
        <Empty icon={RotateCcw} title="No products" text="Products with deliveries will show their return rate here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-soft">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-mist/60 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Product Details</th>
                <th className="px-3 py-3 font-semibold">Orders Delivered</th>
                <th className="px-3 py-3 font-semibold">Customer Return</th>
                <th className="px-3 py-3 font-semibold">Top Return Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id} className="border-t border-border-soft">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb src={p.image} alt={p.title} />
                      <div className="min-w-0">
                        <p className="max-w-[280px] truncate font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">Category: {p.category.name}</p>
                        <div className="mt-1 flex gap-1">
                          {p.wdrpEnabled ? <Badge tone="blue">WDRP enabled</Badge> : null}
                          {p.prepaidEnabled ? <Badge tone="green">Prepaid discount</Badge> : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{p.delivered}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold tabular-nums">{p.returnRate}%</p>
                    <p className="text-xs text-muted-foreground">{p.returns} Returns</p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{p.topReason ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
