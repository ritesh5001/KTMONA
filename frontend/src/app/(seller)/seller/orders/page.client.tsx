"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  PackageCheck,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import {
  sellerCenter,
  inr,
  fmtDate,
  shortId,
  type OrderTab,
  type SellerOrder,
} from "@/services/seller-center";
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
  SearchBox,
  StatusBadge,
  Tabs,
  Thumb,
  errorMessage,
  inputCls,
  useDebounced,
} from "@/components/seller/kit";
import { cn } from "@/lib/utils";

const TABS: { key: OrderTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "ready_to_ship", label: "Ready to Ship" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "rto", label: "RTO" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const TAB_HELP: Record<OrderTab, string> = {
  pending: "New orders. Accept them to generate the shipping label, or cancel if you can't fulfil.",
  ready_to_ship: "Pack the parcel, stick the label, add it to a manifest and hand it to the courier.",
  shipped: "On the way to the customer.",
  delivered: "Delivered orders. Payment is released 7 days after delivery.",
  rto: "Return to origin: the courier is bringing the parcel back to you.",
  cancelled: "Orders cancelled by you, the customer or KTMONA.",
  all: "Every order you have received.",
};

const CANCEL_REASONS = ["Out of stock", "Product damaged", "Wrong price listed", "Unable to ship to this pincode", "Other"];

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.round(Math.abs(ms) / 3_600_000);
  if (ms < 0) return `${hours}h overdue`;
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h left` : `${hours}h left`;
}

export default function SellerOrdersClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();
  const initialTab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "pending") as OrderTab;
  const [tab, setTab] = React.useState<OrderTab>(initialTab);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(params.get("order"));
  const [trackingFor, setTrackingFor] = React.useState<SellerOrder | null>(null);
  const [cancelFor, setCancelFor] = React.useState<SellerOrder | null>(null);

  const key = ["seller-orders", tab, page, debounced] as const;
  const { data, error, isLoading, mutate } = useSWR(key, () => sellerCenter.orders({ tab, page, search: debounced, limit: 20 }), {
    keepPreviousData: true,
  });

  React.useEffect(() => {
    setSelected(new Set());
  }, [tab, page, debounced]);

  const changeTab = (next: OrderTab) => {
    setTab(next);
    setPage(1);
    router.replace(`/seller/orders?tab=${next}`, { scroll: false });
  };

  const refresh = async () => {
    await Promise.all([mutate(), globalMutate("seller-order-counts"), globalMutate((k) => Array.isArray(k) && k[0] === "seller-overview")]);
  };

  const orders = data?.orders ?? [];
  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.orderId));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedIds = [...selected];

  async function run(label: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(label);
    try {
      await fn();
      if (success) toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function summarize(results: { ok: boolean; error?: string }[], verb: string) {
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    if (ok) toast.success(`${ok} order(s) ${verb}`);
    failed.slice(0, 3).forEach((f) => toast.error(f.error ?? "Failed"));
  }

  const accept = (ids: string[]) =>
    run("accept", async () => {
      const res = await sellerCenter.acceptOrders(ids);
      summarize(res.results, "accepted");
      if (res.results.some((r) => r.ok)) toast.message("Labels are ready in the Ready to Ship tab.");
    });
  const ship = (ids: string[]) =>
    run("ship", async () => {
      const res = await sellerCenter.shipOrders(ids);
      summarize(res.results, "marked as shipped");
    });
  const labels = (ids: string[]) => run("labels", () => sellerCenter.downloadLabels(ids), "Labels downloaded");
  const manifest = (ids: string[]) => run("manifest", () => sellerCenter.downloadManifest(ids), "Manifest downloaded");

  return (
    <PageShell>
      <PageHeader
        title="Orders"
        description={TAB_HELP[tab]}
        actions={<SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search order ID, customer, AWB" />}
      />

      <div className="rounded-2xl border border-border-soft bg-card">
        <div className="px-4 pt-2">
          <Tabs tabs={TABS} value={tab} onChange={changeTab} counts={data?.counts} />
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border-soft bg-brand/6 px-4 py-3">
            <span className="mr-2 text-sm font-semibold text-foreground">{selectedIds.length} selected</span>
            {tab === "pending" ? (
              <Btn size="sm" variant="brand" loading={busy === "accept"} onClick={() => accept(selectedIds)}>
                <CheckCircle2 className="h-4 w-4" /> Accept orders
              </Btn>
            ) : null}
            {tab === "ready_to_ship" ? (
              <>
                <Btn size="sm" variant="primary" loading={busy === "labels"} onClick={() => labels(selectedIds)}>
                  <Download className="h-4 w-4" /> Download labels
                </Btn>
                <Btn size="sm" variant="outline" loading={busy === "manifest"} onClick={() => manifest(selectedIds)}>
                  <ClipboardList className="h-4 w-4" /> Generate manifest
                </Btn>
                <Btn size="sm" variant="brand" loading={busy === "ship"} onClick={() => ship(selectedIds)}>
                  <Truck className="h-4 w-4" /> Mark handed over
                </Btn>
              </>
            ) : null}
            {tab === "shipped" || tab === "delivered" ? (
              <Btn size="sm" variant="outline" loading={busy === "labels"} onClick={() => labels(selectedIds)}>
                <Download className="h-4 w-4" /> Re-download labels
              </Btn>
            ) : null}
            <Btn size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Btn>
          </div>
        ) : null}

        {error && !data ? (
          <div className="p-4">
            <ErrorNote message={errorMessage(error, "Could not load orders")} onRetry={() => mutate()} />
          </div>
        ) : isLoading && !data ? (
          <Loading rows={5} />
        ) : orders.length === 0 ? (
          <Empty icon={ClipboardList} title="No orders here" text={debounced ? "No orders match your search." : "Orders will show up here when there is something to do."} />
        ) : (
          <>
          <div className="md:hidden">
            {orders.map((o) => (
              <OrderCard
                key={o.orderId}
                order={o}
                tab={tab}
                selected={selected.has(o.orderId)}
                onToggle={() => toggle(o.orderId)}
                busy={busy}
                onOpen={() => setDetailId(o.orderId)}
                onAccept={() => accept([o.orderId])}
                onLabel={() => labels([o.orderId])}
                onShip={() => ship([o.orderId])}
                onTracking={() => setTrackingFor(o)}
                onCancel={() => setCancelFor(o)}
                onApproveCustomerCancel={() =>
                  run("approve", () => sellerCenter.approveCustomerCancellation(o.orderId), "Cancellation approved. The customer will be refunded.")
                }
                onDeliver={() => run("deliver", () => sellerCenter.deliverOrder(o.orderId), "Marked as delivered")}
                onRto={(action) => run("rto", () => sellerCenter.rto(o.orderId, action), action === "initiated" ? "Marked as RTO" : "RTO marked as received")}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-mist/60 text-xs text-muted-foreground">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.orderId)))}
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">Order</th>
                  <th className="px-3 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">You get</th>
                  <th className="min-w-[150px] whitespace-nowrap px-3 py-3 font-semibold">{tab === "pending" || tab === "ready_to_ship" ? "Dispatch by" : "Status"}</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <OrderRow
                    key={o.orderId}
                    order={o}
                    tab={tab}
                    selected={selected.has(o.orderId)}
                    onToggle={() => toggle(o.orderId)}
                    busy={busy}
                    onOpen={() => setDetailId(o.orderId)}
                    onAccept={() => accept([o.orderId])}
                    onLabel={() => labels([o.orderId])}
                    onShip={() => ship([o.orderId])}
                    onTracking={() => setTrackingFor(o)}
                    onCancel={() => setCancelFor(o)}
                    onApproveCustomerCancel={() =>
                      run("approve", () => sellerCenter.approveCustomerCancellation(o.orderId), "Cancellation approved. The customer will be refunded.")
                    }
                    onDeliver={() => run("deliver", () => sellerCenter.deliverOrder(o.orderId), "Marked as delivered")}
                    onRto={(action) => run("rto", () => sellerCenter.rto(o.orderId, action), action === "initiated" ? "Marked as RTO" : "RTO marked as received")}
                  />
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <Pager page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
      </div>

      <TrackingModal order={trackingFor} onClose={() => setTrackingFor(null)} onSaved={refresh} />
      <CancelModal order={cancelFor} onClose={() => setCancelFor(null)} onDone={refresh} />
      <OrderDrawer orderId={detailId} onClose={() => { setDetailId(null); if (params.get("order")) router.replace(`/seller/orders?tab=${tab}`, { scroll: false }); }} />
    </PageShell>
  );
}

function OrderRow({
  order: o,
  tab,
  selected,
  onToggle,
  busy,
  onOpen,
  onAccept,
  onLabel,
  onShip,
  onTracking,
  onCancel,
  onApproveCustomerCancel,
  onDeliver,
  onRto,
}: {
  order: SellerOrder;
  tab: OrderTab;
  selected: boolean;
  onToggle: () => void;
  busy: string | null;
  onOpen: () => void;
  onAccept: () => void;
  onLabel: () => void;
  onShip: () => void;
  onTracking: () => void;
  onCancel: () => void;
  onApproveCustomerCancel: () => void;
  onDeliver: () => void;
  onRto: (action: "initiated" | "received") => void;
}) {
  const first = o.items[0];
  const awaiting = o.status === "PENDING" || o.status === "READY_TO_SHIP";
  const actionProps = { order: o, tab, busy, onOpen, onAccept, onLabel, onShip, onTracking, onCancel, onApproveCustomerCancel, onDeliver, onRto };
  return (
    <tr className={cn("border-b border-border-soft align-top last:border-0", selected && "bg-brand/5")}>
      <td className="px-4 py-4">
        <input type="checkbox" aria-label={`Select ${shortId(o.orderId)}`} checked={selected} onChange={onToggle} className="h-4 w-4 accent-[var(--color-brand)]" />
      </td>
      <td className="px-3 py-4">
        <button type="button" onClick={onOpen} className="font-semibold text-foreground hover:text-brand-strong">
          {shortId(o.orderId)}
        </button>
        <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(o.orderDate)}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge tone={o.paymentMode === "COD" ? "orange" : "green"}>{o.paymentMode === "COD" ? "COD" : "Prepaid"}</Badge>
          {o.customerCancellation ? <Badge tone="red">Customer wants to cancel</Badge> : null}
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex items-start gap-3">
          <Thumb src={first?.image ?? null} alt={first?.title ?? ""} />
          <div className="min-w-0">
            <p className="max-w-[220px] truncate font-medium text-foreground">{first?.title}</p>
            <p className="text-xs text-muted-foreground">
              {[first?.size && first.size !== "Default" ? `Size ${first.size}` : null, first?.color, first?.sku].filter(Boolean).join(" · ")}
            </p>
            <p className="text-xs text-muted-foreground">
              Qty {o.units}
              {o.items.length > 1 ? ` · +${o.items.length - 1} more item(s)` : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-4 text-sm">
        <p className="font-medium text-foreground">{o.customer.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {o.customer.city} {o.customer.pincode}
        </p>
      </td>
      <td className="whitespace-nowrap px-3 py-4 font-semibold tabular-nums text-foreground">{inr.format(o.sellerAmount)}</td>
      <td className="px-3 py-4">
        {awaiting ? (
          <div>
            <p className={cn("whitespace-nowrap text-sm font-semibold", o.slaBreached ? "text-red-600" : "text-foreground")}>{fmtDate(o.dispatchBy)}</p>
            <p className={cn("flex items-center gap-1 text-xs", o.slaBreached ? "text-red-600" : "text-muted-foreground")}>
              {o.slaBreached ? <AlertTriangle className="h-3 w-3" /> : null}
              {timeLeft(o.dispatchBy)}
            </p>
            {o.shipment ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {o.shipment.awb ? `${o.shipment.carrier} · ${o.shipment.awb}` : "AWB not added"}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            <StatusBadge status={o.status} />
            {o.shipment?.awb ? <p className="text-xs text-muted-foreground">{o.shipment.carrier} · {o.shipment.awb}</p> : null}
            {o.lateDispatch ? <p className="text-xs text-red-600">Dispatched late</p> : null}
            {o.status === "DELIVERED" && o.expectedPayoutDate ? <p className="text-xs text-muted-foreground">Payout {fmtDate(o.expectedPayoutDate)}</p> : null}
          </div>
        )}
      </td>
      <td className="px-4 py-4">
        <OrderActions {...actionProps} />
      </td>
    </tr>
  );
}

type ActionProps = {
  order: SellerOrder;
  tab: OrderTab;
  busy: string | null;
  onOpen: () => void;
  onAccept: () => void;
  onLabel: () => void;
  onShip: () => void;
  onTracking: () => void;
  onCancel: () => void;
  onApproveCustomerCancel: () => void;
  onDeliver: () => void;
  onRto: (action: "initiated" | "received") => void;
};

function OrderActions({ order: o, tab, busy, onOpen, onAccept, onLabel, onShip, onTracking, onCancel, onApproveCustomerCancel, onDeliver, onRto }: ActionProps) {
  return (
        <div className="flex flex-wrap justify-end gap-2">
          {o.status === "PENDING" ? (
            <>
              {o.customerCancellation ? (
                <Btn size="sm" variant="danger" loading={busy === "approve"} onClick={onApproveCustomerCancel}>
                  Approve cancel
                </Btn>
              ) : null}
              <Btn size="sm" variant="brand" loading={busy === "accept"} onClick={onAccept}>
                Accept
              </Btn>
              <Btn size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Btn>
            </>
          ) : null}
          {o.status === "READY_TO_SHIP" ? (
            <>
              <Btn size="sm" variant="outline" loading={busy === "labels"} onClick={onLabel}>
                <FileText className="h-3.5 w-3.5" /> Label
              </Btn>
              {o.shipment?.mode === "SELF_SHIP" ? (
                <Btn size="sm" variant="outline" onClick={onTracking}>
                  {o.shipment.awb ? "Edit AWB" : "Add AWB"}
                </Btn>
              ) : null}
              <Btn size="sm" variant="brand" loading={busy === "ship"} onClick={onShip} disabled={!o.shipment?.awb}>
                Handed over
              </Btn>
              <Btn size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Btn>
            </>
          ) : null}
          {o.status === "SHIPPED" ? (
            <>
              {o.shipment?.mode === "SELF_SHIP" ? (
                <Btn size="sm" variant="outline" loading={busy === "deliver"} onClick={onDeliver}>
                  <PackageCheck className="h-3.5 w-3.5" /> Delivered
                </Btn>
              ) : null}
              <Btn size="sm" variant="ghost" loading={busy === "rto"} onClick={() => onRto("initiated")}>
                <RotateCcw className="h-3.5 w-3.5" /> RTO
              </Btn>
            </>
          ) : null}
          {o.status === "RTO_INITIATED" ? (
            <Btn size="sm" variant="outline" loading={busy === "rto"} onClick={() => onRto("received")}>
              Mark RTO received
            </Btn>
          ) : null}
          {tab !== "pending" && o.status !== "PENDING" && o.status !== "READY_TO_SHIP" ? (
            <Btn size="sm" variant="ghost" onClick={onOpen}>
              Details
            </Btn>
          ) : null}
        </div>
  );
}

/** Phone layout: one card per order with the same actions as the table row. */
function OrderCard(props: ActionProps & { selected: boolean; onToggle: () => void }) {
  const { order: o, selected, onToggle, onOpen } = props;
  const first = o.items[0];
  const awaiting = o.status === "PENDING" || o.status === "READY_TO_SHIP";
  return (
    <div className={cn("border-b border-border-soft p-4 last:border-0", selected && "bg-brand/5")}>
      <div className="flex items-start gap-3">
        <input type="checkbox" aria-label={`Select ${shortId(o.orderId)}`} checked={selected} onChange={onToggle} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
        <Thumb src={first?.image ?? null} alt={first?.title ?? ""} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={onOpen} className="text-sm font-semibold text-foreground">{shortId(o.orderId)}</button>
            <span className="text-sm font-semibold tabular-nums">{inr.format(o.sellerAmount)}</span>
          </div>
          <p className="truncate text-sm text-foreground">{first?.title}</p>
          <p className="text-xs text-muted-foreground">
            Qty {o.units} · {o.customer.name} · {o.customer.city}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={o.paymentMode === "COD" ? "orange" : "green"}>{o.paymentMode === "COD" ? "COD" : "Prepaid"}</Badge>
            {awaiting ? (
              <span className={cn("text-xs font-semibold", o.slaBreached ? "text-red-600" : "text-muted-foreground")}>
                Dispatch by {fmtDate(o.dispatchBy)} · {timeLeft(o.dispatchBy)}
              </span>
            ) : (
              <StatusBadge status={o.status} />
            )}
            {o.customerCancellation ? <Badge tone="red">Customer wants to cancel</Badge> : null}
          </div>
          {o.shipment?.awb ? <p className="mt-1 text-xs text-muted-foreground">{o.shipment.carrier} · {o.shipment.awb}</p> : null}
        </div>
      </div>
      <div className="mt-3">
        <OrderActions {...props} />
      </div>
    </div>
  );
}

function TrackingModal({ order, onClose, onSaved }: { order: SellerOrder | null; onClose: () => void; onSaved: () => void }) {
  const [carrier, setCarrier] = React.useState("");
  const [awb, setAwb] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    setCarrier(order?.shipment?.carrier && order.shipment.carrier !== "Self Ship" ? order.shipment.carrier : "");
    setAwb(order?.shipment?.awb ?? "");
  }, [order]);
  if (!order) return null;
  const save = async () => {
    setSaving(true);
    try {
      await sellerCenter.updateTracking(order.orderId, carrier, awb);
      toast.success("Tracking saved");
      onSaved();
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
      title={`Courier details · ${shortId(order.orderId)}`}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={save} disabled={carrier.trim().length < 2 || awb.trim().length < 4}>Save</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">You ship this order yourself. Enter the courier and the AWB/tracking number printed on the courier receipt.</p>
        <Field label="Courier partner">
          <input list="ktm-couriers" value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls} placeholder="e.g. Delhivery" />
          <datalist id="ktm-couriers">
            {["Delhivery", "Blue Dart", "DTDC", "Ecom Express", "Xpressbees", "Shadowfax", "India Post", "Ekart"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="AWB / tracking number">
          <input value={awb} onChange={(e) => setAwb(e.target.value)} className={inputCls} placeholder="e.g. 1234567890123" />
        </Field>
      </div>
    </Modal>
  );
}

function CancelModal({ order, onClose, onDone }: { order: SellerOrder | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState(CANCEL_REASONS[0]);
  const [other, setOther] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  if (!order) return null;
  const finalReason = reason === "Other" ? other.trim() : reason;
  const submit = async () => {
    setSaving(true);
    try {
      const res = await sellerCenter.cancelOrder(order.orderId, finalReason);
      toast.success(res.needsAdminApproval ? "Cancellation sent to KTMONA for approval" : "Order cancelled. The customer will be refunded.");
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
      title={`Cancel ${shortId(order.orderId)}?`}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Keep order</Btn>
          <Btn variant="danger" loading={saving} onClick={submit} disabled={finalReason.length < 3}>
            <XCircle className="h-4 w-4" /> Cancel order
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-brand/30 bg-brand/8 p-3 text-sm text-brand-strong">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Seller cancellations lower your account health score. Keep your inventory updated to avoid them.
        </div>
        <Field label="Reason">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
            {CANCEL_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        {reason === "Other" ? (
          <Field label="Tell us more">
            <input value={other} onChange={(e) => setOther(e.target.value)} className={inputCls} />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}

function OrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { data, error, isLoading } = useSWR(orderId ? ["seller-order", orderId] : null, () => sellerCenter.order(orderId!));
  if (!orderId) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Order details">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <aside className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-card shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border-soft bg-card px-5 py-4">
          <h2 className="text-base font-semibold">Order {shortId(orderId)}</h2>
          <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
        </div>
        {error ? (
          <div className="p-5"><ErrorNote message={errorMessage(error)} /></div>
        ) : isLoading || !data ? (
          <Loading rows={6} />
        ) : (
          <div className="space-y-5 p-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={data.status} />
              <Badge tone={data.paymentMode === "COD" ? "orange" : "green"}>{data.paymentMode}</Badge>
              <span className="text-xs text-muted-foreground">Ordered {fmtDate(data.orderDate, true)}</span>
            </div>
            <div className="rounded-xl border border-border-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliver to</p>
              <p className="mt-1 font-medium">{data.customer.name}</p>
              <p className="text-muted-foreground">{data.customer.city} {data.customer.pincode}</p>
            </div>
            <div className="space-y-3">
              {data.items.map((i) => (
                <div key={i.id} className="flex gap-3">
                  <Thumb src={i.image} alt={i.title} />
                  <div className="flex-1">
                    <p className="font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">{[i.size, i.color, i.sku].filter(Boolean).join(" · ")}</p>
                    <p className="text-xs text-muted-foreground">Qty {i.quantity} × {inr.format(i.sellerPrice)}</p>
                  </div>
                  <span className="font-semibold">{inr.format(i.lineTotal)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border-soft pt-3 font-semibold">
                <span>You get (before commission)</span>
                <span>{inr.format(data.sellerAmount)}</span>
              </div>
            </div>
            {data.shipment ? (
              <div className="rounded-xl border border-border-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipment</p>
                <p className="mt-1">{data.shipment.carrier} {data.shipment.awb ? `· AWB ${data.shipment.awb}` : ""}</p>
                <p className="text-xs text-muted-foreground">{data.shipment.mode === "SHIPROCKET" ? "Booked via Shiprocket" : "Self-ship"}{data.shipment.manifestId ? ` · Manifest ${data.shipment.manifestId}` : ""}</p>
                {data.shipment.rtoReason ? <p className="mt-1 text-xs text-red-600">RTO: {data.shipment.rtoReason}</p> : null}
              </div>
            ) : null}
            {data.timeline && data.timeline.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</p>
                <ol className="space-y-3 border-l border-border-soft pl-4">
                  {data.timeline.map((t, idx) => (
                    <li key={idx} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand" />
                      <p className="font-medium"><StatusBadge status={t.status} /></p>
                      <p className="text-xs text-muted-foreground">{t.note} · {fmtDate(t.at, true)}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}
