"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadInvoice,
  getBuyerOrder,
  reorder,
  type BuyerOrderDetail,
  type BuyerOrderReturn,
  type TrackingStage,
} from "@/services/orders";
import { requestCancellation } from "@/services/cancellations";
import {
  appealReturn,
  requestReturn,
  RETURN_REASONS,
  RETURN_WINDOW_DAYS,
  SELLER_FAULT_REASONS,
  type ReturnReasonCode,
} from "@/services/returns";
import { retryPayment, verifyRazorpayPayment } from "@/services/payments";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { useImageKitUpload } from "@/lib/use-imagekit-upload";
import { formatInr } from "@/components/checkout/PriceBreakup";
import { useLiveFreshness } from "@/hooks/use-live-freshness";

const PLACEHOLDER = "/images/product-placeholder.svg";

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery is taking too long",
  "Want to change the size / colour",
  "Want to change the delivery address",
  "Other",
];

function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", withTime
    ? { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }
    : { weekday: "short", day: "numeric", month: "short" });
}

function statusLabel(order: BuyerOrderDetail) {
  if (order.status === "PLACED") {
    return order.paymentStatus === "FAILED" ? "Payment failed" : "Payment pending";
  }
  const current = order.timeline.find((s) => s.current);
  return current?.label ?? order.status;
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);
  const [order, setOrder] = React.useState<BuyerOrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState<"cancel" | "return" | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!orderId) return;
    try {
      const { order: o } = await getBuyerOrder(orderId);
      setOrder(o);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load this order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useLiveFreshness({
    eventTypes: ["order.updated", "shipment.updated", "payment.updated"],
    onEvent: () => void load(),
  });

  const buyAgain = async () => {
    if (!order) return;
    setBusy("reorder");
    try {
      const res = await reorder(order.id);
      if (res.added > 0) toast.success(res.message, { action: { label: "View cart", onClick: () => (window.location.href = "/cart") } });
      else toast.error(res.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add to cart");
    } finally {
      setBusy(null);
    }
  };

  const retry = async () => {
    if (!order) return;
    setBusy("pay");
    try {
      const { data: payment } = await retryPayment(order.id);
      const result = await openRazorpayCheckout(payment);
      if (result.status === "dismissed") {
        if (result.lastError) toast.error(`Payment not completed: ${result.lastError}`);
        return;
      }
      await verifyRazorpayPayment({ orderId: order.id, razorpayPaymentId: result.razorpayPaymentId, razorpaySignature: result.razorpaySignature }).catch(() => null);
      toast.success("Payment successful");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to retry payment");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;
  }
  if (!order) {
    return <p className="text-sm text-muted-foreground">Order not found. <Link href="/user/orders" className="underline">Back to orders</Link></p>;
  }

  const unpaid = order.status === "PLACED" && order.paymentMethod !== "COD";
  const attempt = order.shipments.find((s) => s.deliveryAttempt)?.deliveryAttempt;
  const late = order.estimatedDelivery && order.status === "SHIPPED" && Date.now() > new Date(order.estimatedDelivery.to).getTime();
  const itemsById = new Map(order.items.map((i) => [i.id, i]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/user/orders" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> My orders
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Order {order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {fmtDate(order.createdAt, true)} · <span className="font-medium text-foreground">{statusLabel(order)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.invoiceNumber ? (
            <Button variant="outline" size="sm" onClick={() => downloadInvoice(order.id).catch((e) => toast.error(e.message))}>
              <FileText className="mr-1.5 h-4 w-4" /> Invoice
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void buyAgain()} disabled={busy === "reorder"}>
            <ShoppingCart className="mr-1.5 h-4 w-4" /> Buy again
          </Button>
          <Button asChild variant="outline" size="sm"><Link href={`/support?orderId=${order.id}`}>Need help?</Link></Button>
        </div>
      </div>

      {/* Alerts */}
      {unpaid ? (
        <Banner tone="warn" title={order.paymentStatus === "FAILED" ? "Payment failed" : "Payment pending"}>
          Complete the payment within 30 minutes of ordering to confirm it. Retrying uses the same order — you won’t be charged twice.
          <div className="mt-3"><Button size="sm" onClick={() => void retry()} disabled={busy === "pay"}>{busy === "pay" ? "Opening…" : `Retry payment · ${formatInr(order.totalAmount)}`}</Button></div>
        </Banner>
      ) : null}
      {attempt ? (
        <Banner tone="warn" title="Delivery attempt unsuccessful">
          The courier reported: “{attempt.note}”. They will try again. Please keep your phone reachable, or contact support to update the address.
        </Banner>
      ) : null}
      {late && !attempt ? (
        <Banner tone="info" title="Running a little late">
          Your order is taking longer than the estimate. It is still on its way and we are following up with the courier.
        </Banner>
      ) : null}

      {/* Tracking */}
      {order.status !== "PLACED" ? (
        <Card title="Track your order">
          {order.estimatedDelivery ? (
            <p className="mb-4 flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-brand-strong" />
              Estimated delivery <strong>{fmtDate(order.estimatedDelivery.from)} – {fmtDate(order.estimatedDelivery.to)}</strong>
            </p>
          ) : null}
          {order.shipments.length <= 1 ? (
            <>
              <Timeline stages={order.shipments[0]?.stages ?? order.timeline} />
              {order.shipments[0] ? <ShipmentInfo shipment={order.shipments[0]} /> : order.status !== "CANCELLED" ? (
                <p className="mt-4 text-sm text-muted-foreground">Waiting for the seller to confirm and pack your order.</p>
              ) : null}
            </>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">Your order is coming in {order.shipments.length} packages from different sellers.</p>
              {order.shipments.map((s, i) => (
                <div key={s.id} className="rounded-xl border border-border-soft p-4">
                  <p className="mb-3 text-sm font-semibold">Package {i + 1} · {s.itemIds.map((id) => itemsById.get(id)?.productTitle).filter(Boolean).join(", ")}</p>
                  <Timeline stages={s.stages} />
                  <ShipmentInfo shipment={s} />
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {/* Items */}
      <Card title={`Items (${order.items.length})`}>
        <ul className="divide-y divide-border-soft">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
              <Link href={`/product/${item.productId}`} className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-mist">
                <Image src={item.image ?? PLACEHOLDER} alt="" fill sizes="64px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1 text-sm">
                <Link href={`/product/${item.productId}`} className="line-clamp-2 font-medium hover:underline">{item.productTitle ?? "Item"}</Link>
                <p className="text-xs text-muted-foreground">
                  {[item.color, item.size && item.size !== "Default" ? item.size : null].filter(Boolean).join(" / ")} · Qty {item.quantity}
                </p>
                {item.isReturnable === false ? (
                  <p className="mt-1 inline-block rounded bg-mist px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    Non-returnable · replaced only if wrong, damaged, defective or incomplete
                  </p>
                ) : null}
              </div>
              <p className="text-sm font-medium">{formatInr(item.priceSnapshot * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border-soft pt-4">
          {order.eligibility.cancel.allowed ? (
            <Button variant="outline" size="sm" onClick={() => setModal("cancel")}><X className="mr-1.5 h-4 w-4" /> Cancel order</Button>
          ) : null}
          {order.eligibility.return.allowed ? (
            <Button variant="outline" size="sm" onClick={() => setModal("return")}><RotateCcw className="mr-1.5 h-4 w-4" /> Return / Replace</Button>
          ) : null}
        </div>
        <PolicyNote order={order} />
      </Card>

      {/* Returns & replacements */}
      {order.returns.length ? (
        <Card title="Returns & replacements">
          <div className="space-y-4">
            {order.returns.map((r) => <ReturnCard key={r.id} request={r} items={itemsById} onChange={load} />)}
          </div>
        </Card>
      ) : null}

      {/* Cancellation */}
      {order.cancellation ? (
        <Card title="Cancellation">
          <p className="text-sm">
            Status: <strong>{order.cancellation.status === "REQUESTED" ? "Requested — the seller is reviewing it" : order.cancellation.status === "APPROVED" ? "Cancelled" : "Declined"}</strong>
          </p>
          <p className="text-sm text-muted-foreground">Reason: {order.cancellation.reason}</p>
          {order.cancellation.rejectionReason ? <p className="text-sm text-muted-foreground">Why it was declined: {order.cancellation.rejectionReason}</p> : null}
        </Card>
      ) : null}

      {/* Refunds */}
      {order.refunds.length ? (
        <Card title="Refunds">
          <ul className="space-y-3 text-sm">
            {order.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft p-3">
                <div>
                  <p className="font-medium">{formatInr(r.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.status === "SUCCESS" ? `Refunded on ${fmtDate(r.updatedAt)}` : r.status === "PENDING" ? `Processing since ${fmtDate(r.createdAt)}` : "Refund failed — our team will retry or contact you"}
                    {r.reference ? <> · Ref <span className="font-mono">{r.reference}</span></> : null}
                  </p>
                </div>
                <StatusPill status={r.status === "SUCCESS" ? "Refunded" : r.status === "PENDING" ? "Processing" : "Failed"} tone={r.status === "SUCCESS" ? "good" : r.status === "PENDING" ? "warn" : "bad"} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Online payments are refunded to the original payment method: UPI usually within 24 hours, cards and net banking in 5–7 working days. Cash on Delivery refunds go to the bank / UPI details saved in your account.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Delivery address">
          <div className="space-y-0.5 text-sm">
            <p className="font-medium">{order.shippingName}</p>
            <p className="text-muted-foreground">{order.shippingAddressLine1}{order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}</p>
            <p className="text-muted-foreground">{order.shippingCity} – {order.shippingPincode}</p>
            <p className="text-muted-foreground">{order.shippingPhone}</p>
            {order.shippingNotes ? <p className="pt-2 text-xs">Delivery instructions: {order.shippingNotes}</p> : null}
          </div>
        </Card>
        <Card title="Price details">
          <dl className="space-y-2 text-sm">
            <Row label="Price (MRP)" value={formatInr(order.charges.mrpTotal)} />
            {order.charges.productDiscount > 0 ? <Row label="Discount on MRP" value={`−${formatInr(order.charges.productDiscount)}`} good /> : null}
            {order.charges.couponDiscount > 0 ? <Row label={`Coupon ${order.charges.couponCode ?? ""}`} value={`−${formatInr(order.charges.couponDiscount)}`} good /> : null}
            {order.charges.autoDiscount ? <Row label={order.charges.autoDiscountLabel ?? "Offer"} value={`−${formatInr(order.charges.autoDiscount)}`} good /> : null}
            <Row label="Delivery" value={order.charges.shipping > 0 ? formatInr(order.charges.shipping) : "FREE"} />
            {order.charges.tax > 0 ? <Row label="GST" value={formatInr(order.charges.tax)} /> : null}
            {order.charges.walletAmount ? <Row label="Cashback used" value={`−${formatInr(order.charges.walletAmount)}`} good /> : null}
            <div className="h-px bg-border-soft" />
            <Row label="Order total" value={formatInr(order.charges.total)} bold />
            <p className="pt-1 text-xs text-muted-foreground">
              {order.paymentMethod === "COD" ? "Cash on Delivery" : `Paid online${order.paymentStatus === "SUCCESS" ? "" : " (pending)"}`}
            </p>
          </dl>
        </Card>
      </div>

      {modal === "cancel" ? <CancelModal order={order} onClose={() => setModal(null)} onDone={load} /> : null}
      {modal === "return" ? <ReturnModal order={order} onClose={() => setModal(null)} onDone={load} /> : null}
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-soft bg-card p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Banner({ tone, title, children }: { tone: "warn" | "info"; title: string; children: React.ReactNode }) {
  return (
    <div role="status" className={`flex gap-3 rounded-2xl border p-4 text-sm ${tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div><p className="font-semibold">{title}</p><div>{children}</div></div>
    </div>
  );
}

function Row({ label, value, good, bold }: { label: string; value: string; good?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <dt className={bold ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className={good ? "text-emerald-700" : ""}>{value}</dd>
    </div>
  );
}

function StatusPill({ status, tone }: { status: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const cls = { good: "bg-emerald-50 text-emerald-800", warn: "bg-amber-50 text-amber-800", bad: "bg-red-50 text-red-700", neutral: "bg-mist text-foreground" }[tone];
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{status}</span>;
}

function Timeline({ stages }: { stages: TrackingStage[] }) {
  return (
    <ol className="relative space-y-4 pl-7">
      {stages.map((s, i) => {
        const bad = s.key === "CANCELLED" || s.key === "DELIVERY_FAILED";
        return (
          <li key={s.key} className="relative">
            {i < stages.length - 1 ? (
              <span className={`absolute -left-[19px] top-5 h-[calc(100%+4px)] w-0.5 ${stages[i + 1]?.done ? "bg-emerald-500" : "bg-border-soft"}`} aria-hidden />
            ) : null}
            <span
              className={`absolute -left-7 top-0.5 flex h-5 w-5 items-center justify-center rounded-full ${
                bad ? "bg-red-500 text-white" : s.done ? "bg-emerald-500 text-white" : "border-2 border-border-soft bg-card"
              } ${s.current ? "ring-4 ring-emerald-100" : ""}`}
              aria-hidden
            >
              {s.done ? (bad ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />) : null}
            </span>
            <p className={`text-sm ${s.done ? "font-medium text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
            {s.at ? <p className="text-xs text-muted-foreground">{fmtDate(s.at, true)}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

function ShipmentInfo({ shipment }: { shipment: BuyerOrderDetail["shipments"][number] }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-mist/50 p-3 text-sm">
      <span>Courier: <strong>{shipment.carrier}</strong></span>
      {shipment.trackingNumber ? (
        <span className="inline-flex items-center gap-1.5">
          Tracking ID: <strong className="font-mono">{shipment.trackingNumber}</strong>
          <button
            type="button"
            aria-label="Copy tracking ID"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => navigator.clipboard?.writeText(shipment.trackingNumber).then(() => toast.success("Tracking ID copied"))}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : null}
      {shipment.trackingUrl ? (
        <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-strong hover:underline">
          Track on courier website <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
      {shipment.courierStatus ? <span className="w-full text-xs text-muted-foreground">Latest update: {shipment.courierStatus}</span> : null}
    </div>
  );
}

function PolicyNote({ order }: { order: BuyerOrderDetail }) {
  const msgs: string[] = [];
  if (!order.eligibility.cancel.allowed && order.eligibility.cancel.reason && order.status !== "CANCELLED") msgs.push(order.eligibility.cancel.reason);
  if (order.status === "DELIVERED") {
    if (order.eligibility.return.allowed && order.eligibility.return.windowEndsAt) {
      msgs.push(`Return or replacement available until ${fmtDate(order.eligibility.return.windowEndsAt)}.`);
    } else if (order.eligibility.return.reason) {
      msgs.push(order.eligibility.return.reason);
    }
  } else if (order.status !== "CANCELLED") {
    msgs.push(`Free cancellation until the order ships. After delivery you can return or replace items within ${RETURN_WINDOW_DAYS} days.`);
  }
  return msgs.length ? <p className="mt-3 text-xs text-muted-foreground">{msgs.join(" ")}</p> : null;
}

const RETURN_STEP_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  INSPECTING: "Item received, under inspection",
  REFUNDED: "Refunded",
  REPLACED: "Replacement sent",
  REJECTED: "Rejected",
};

function ReturnCard({ request: r, items, onChange }: { request: BuyerOrderReturn; items: Map<string, BuyerOrderDetail["items"][number]>; onChange: () => void }) {
  const [appeal, setAppeal] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const reasonLabel = RETURN_REASONS.find((x) => x.code === r.reasonCode)?.label ?? r.reasonCode ?? "";
  const kind = r.type === "REPLACEMENT" ? "Replacement" : "Return";
  const pickupLabel = r.pickupStatus === "SCHEDULED" ? "Pickup scheduled" : r.pickupStatus === "PICKED_UP" ? "Picked up" : r.pickupStatus === "RECEIVED" ? "Received by seller" : null;
  const tone = r.status === "REJECTED" ? "bad" : r.status === "REFUNDED" || r.status === "REPLACED" ? "good" : "warn";

  const submitAppeal = async () => {
    setSending(true);
    try {
      await appealReturn(r.id, appeal);
      toast.success("Appeal sent. Our team will review it within 48 hours.");
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the appeal");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border-soft p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{kind} request · {fmtDate(r.createdAt)}</p>
        <StatusPill status={RETURN_STEP_LABELS[r.status] ?? r.status} tone={tone} />
      </div>
      <p className="text-muted-foreground">
        {r.items.map((i) => `${items.get(i.orderItemId)?.productTitle ?? "Item"} × ${i.quantity}`).join(", ")}
      </p>
      <p>Reason: {reasonLabel}{r.reason && r.reason !== reasonLabel ? ` — ${r.reason}` : ""}</p>
      {r.images.length ? (
        <div className="flex gap-2">
          {r.images.map((src) => (
            <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative h-14 w-14 overflow-hidden rounded-lg bg-mist">
              <Image src={src} alt="Photo you uploaded" fill sizes="56px" className="object-cover" />
            </a>
          ))}
        </div>
      ) : null}

      {r.status !== "REJECTED" && r.status !== "REFUNDED" && r.status !== "REPLACED" ? (
        <div className="rounded-lg bg-mist/60 p-3 text-xs leading-relaxed">
          <p className="font-semibold">Pickup {pickupLabel ? `· ${pickupLabel}` : "· to be scheduled"}</p>
          {r.pickupDate ? <p>Pickup date: {fmtDate(r.pickupDate)}</p> : null}
          {r.pickupCarrier || r.pickupTracking ? <p>{[r.pickupCarrier, r.pickupTracking ? `Tracking ${r.pickupTracking}` : null].filter(Boolean).join(" · ")}</p> : null}
          <p className="mt-1">
            The courier will collect the item from your delivery address. Keep it unused, with tags and the original packaging, and hand over all items listed above.
          </p>
        </div>
      ) : null}

      {r.status === "REFUNDED" && r.refundAmount != null ? <p className="text-emerald-700">Refund of {formatInr(r.refundAmount)} processed — see Refunds below for the reference number.</p> : null}
      {r.status === "REPLACED" ? <p className="text-emerald-700">Your replacement is on its way{r.replacementTracking ? ` (tracking ${r.replacementTracking})` : ""}.</p> : null}

      {r.status === "REJECTED" ? (
        <div className="space-y-2 rounded-lg bg-red-50 p-3 text-xs text-red-900">
          <p><strong>Why it was rejected:</strong> {r.rejectionReason ?? "The request did not meet the return policy."}</p>
          {r.appealedAt ? (
            <p>You appealed on {fmtDate(r.appealedAt)}. Our team will get back to you.</p>
          ) : (
            <>
              <Textarea value={appeal} onChange={(e) => setAppeal(e.target.value)} placeholder="Tell us why this should be reconsidered (at least 10 characters)" className="min-h-16 bg-white text-sm" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={appeal.trim().length < 10 || sending} onClick={() => void submitAppeal()}>{sending ? "Sending…" : "Appeal decision"}</Button>
                <Button asChild size="sm" variant="outline"><Link href="/support">Contact support</Link></Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CancelModal({ order, onClose, onDone }: { order: BuyerOrderDetail; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState(CANCEL_REASONS[0]!);
  const [other, setOther] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const submit = async () => {
    const text = reason === "Other" ? other.trim() : reason;
    if (text.length < 3) return toast.error("Please tell us why you want to cancel.");
    setSending(true);
    try {
      await requestCancellation(order.id, text);
      toast.success("Cancellation requested");
      onClose();
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request cancellation");
    } finally {
      setSending(false);
    }
  };
  return (
    <ModalShell title="Cancel order" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-mist/60 p-3 text-xs leading-relaxed">
          <p className="font-semibold">Cancellation is free before the order ships.</p>
          <p>
            {order.paymentMethod === "COD"
              ? "Nothing was charged for this Cash on Delivery order."
              : `${formatInr(order.totalAmount)} will be refunded to your original payment method (UPI within 24 hours, cards/net banking in 5–7 working days).`}{" "}
            The seller confirms the cancellation; you’ll see the status here.
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium">Reason for cancelling</legend>
          {CANCEL_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input type="radio" name="cancel-reason" checked={reason === r} onChange={() => setReason(r)} /> {r}
            </label>
          ))}
        </fieldset>
        {reason === "Other" ? <Textarea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Tell us more" className="min-h-16" /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Keep order</Button>
          <Button onClick={() => void submit()} disabled={sending}>{sending ? "Submitting…" : "Request cancellation"}</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function ReturnModal({ order, onClose, onDone }: { order: BuyerOrderDetail; onClose: () => void; onDone: () => void }) {
  const [type, setType] = React.useState<"RETURN" | "REPLACEMENT">("RETURN");
  const [reasonCode, setReasonCode] = React.useState<ReturnReasonCode | "">("");
  const [details, setDetails] = React.useState("");
  const [qty, setQty] = React.useState<Record<string, number>>(() => Object.fromEntries(order.items.map((i) => [i.id, i.quantity])));
  const [selected, setSelected] = React.useState<Record<string, boolean>>(() => Object.fromEntries(order.items.map((i) => [i.id, order.items.length === 1])));
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const { upload, uploading } = useImageKitUpload("/returns");

  const reason = RETURN_REASONS.find((r) => r.code === reasonCode);
  const chosen = order.items.filter((i) => selected[i.id]);
  const blockedNonReturnable = reasonCode !== "" && !SELLER_FAULT_REASONS.has(reasonCode) && chosen.some((i) => i.isReturnable === false);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 6 - photos.length)) {
      try {
        const url = await upload(file);
        setPhotos((p) => [...p, url]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Photo upload failed");
      }
    }
  };

  const submit = async () => {
    if (!chosen.length) return toast.error("Select at least one item.");
    if (!reason) return toast.error("Select a reason.");
    if (reason.needsPhoto && photos.length === 0) return toast.error("Please add a photo showing the problem.");
    if (blockedNonReturnable) return toast.error("Non-returnable items can come back only if wrong, damaged, defective or incomplete.");
    setSending(true);
    try {
      await requestReturn(
        order.id,
        details.trim().length >= 3 ? details.trim() : reason.label,
        chosen.map((i) => ({ orderItemId: i.id, quantity: qty[i.id] ?? i.quantity })),
        { type, reasonCode: reason.code, images: photos }
      );
      toast.success(type === "REPLACEMENT" ? "Replacement requested" : "Return requested");
      onClose();
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit the request");
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell title="Return or replace" onClose={onClose}>
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What would you like?">
          {(["RETURN", "REPLACEMENT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`rounded-xl border p-3 text-left ${type === t ? "border-brand bg-brand/5" : "border-border-soft"}`}
            >
              <span className="block font-medium">{t === "RETURN" ? "Return for refund" : "Replace item"}</span>
              <span className="block text-xs text-muted-foreground">{t === "RETURN" ? "Get your money back" : "Get the same item again"}</span>
            </button>
          ))}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium">Which items?</legend>
          {order.items.map((i) => (
            <label key={i.id} className="flex items-center gap-3 rounded-lg border border-border-soft p-2">
              <input type="checkbox" checked={Boolean(selected[i.id])} onChange={(e) => setSelected({ ...selected, [i.id]: e.target.checked })} />
              <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded bg-mist"><Image src={i.image ?? PLACEHOLDER} alt="" fill sizes="40px" className="object-cover" /></span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1">{i.productTitle}</span>
                {i.isReturnable === false ? <span className="block text-[11px] text-muted-foreground">Non-returnable</span> : null}
              </span>
              {i.quantity > 1 ? (
                <select aria-label="Quantity" value={qty[i.id]} onChange={(e) => setQty({ ...qty, [i.id]: Number(e.target.value) })} className="h-8 rounded border border-border-soft bg-background px-1 text-xs">
                  {Array.from({ length: i.quantity }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}
                </select>
              ) : null}
            </label>
          ))}
        </fieldset>

        <label className="block space-y-1">
          <span className="font-medium">Reason</span>
          <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)} className="h-10 w-full rounded-lg border border-border-soft bg-background px-2">
            <option value="">Select a reason</option>
            {RETURN_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </label>
        {blockedNonReturnable ? (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">A selected item is non-returnable. It can come back only if it is wrong, damaged, defective or incomplete.</p>
        ) : null}

        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe the problem (optional)" maxLength={500} className="min-h-16" />

        <div className="space-y-2">
          <p className="font-medium">Photos {reason?.needsPhoto ? <span className="text-red-600">*</span> : <span className="text-xs font-normal text-muted-foreground">(optional)</span>}</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((src) => (
              <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg bg-mist">
                <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((p) => p !== src))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {photos.length < 6 ? (
              <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-soft text-muted-foreground hover:bg-mist">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                <span className="text-[10px]">Add</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void addPhotos(e.target.files)} />
              </label>
            ) : null}
          </div>
        </div>

        <p className="rounded-lg bg-mist/60 p-3 text-xs leading-relaxed">
          After approval a courier picks the item up from your delivery address. Keep it unused, with tags and original packaging.{" "}
          {type === "RETURN"
            ? order.paymentMethod === "COD"
              ? "COD refunds go to the bank / UPI details in My Account."
              : "The refund goes to your original payment method once the item is received."
            : "The replacement is sent once the item is picked up (or refunded if it is out of stock)."}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={sending || uploading}>{sending ? "Submitting…" : "Submit request"}</Button>
        </div>
      </div>
    </ModalShell>
  );
}
