"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBuyerOrder, type BuyerOrderDetail } from "@/services/orders";
import { retryPayment, verifyRazorpayPayment } from "@/services/payments";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { formatInr } from "@/components/checkout/PriceBreakup";
import { hasSession } from "@/lib/session";
import { loginUrlWithReturn } from "@/lib/login-redirect";

const PLACEHOLDER = "/images/product-placeholder.svg";
/** Unpaid online orders are cancelled after this long (see the backend sweep). */
const PAYMENT_WINDOW_MIN = 30;

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function OrderConfirmationPage() {
  return (
    <React.Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <OrderConfirmation />
    </React.Suspense>
  );
}

function OrderConfirmation() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const orderId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);
  const [order, setOrder] = React.useState<BuyerOrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [retrying, setRetrying] = React.useState(false);
  const [lastError, setLastError] = React.useState<string | null>(search.get("error"));
  const polls = React.useRef(0);

  const load = React.useCallback(async () => {
    if (!orderId) return;
    try {
      const { order: o } = await getBuyerOrder(orderId);
      setOrder(o);
      return o;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load your order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  React.useEffect(() => {
    if (!hasSession()) {
      router.replace(loginUrlWithReturn());
      return;
    }
    void load();
  }, [load, router]);

  // Paid but not confirmed yet (webhook in flight): check again a few times.
  const awaitingConfirmation =
    order?.status === "PLACED" && order.paymentMethod !== "COD" && order.paymentStatus === "SUCCESS";
  React.useEffect(() => {
    if (!awaitingConfirmation || polls.current >= 6) return;
    const t = window.setTimeout(() => {
      polls.current += 1;
      void verifyRazorpayPayment({ orderId: order!.id }).catch(() => null).then(load);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [awaitingConfirmation, load, order]);

  const handleRetry = async () => {
    if (!order || retrying) return;
    setRetrying(true);
    try {
      const { data: payment } = await retryPayment(order.id);
      const result = await openRazorpayCheckout(payment);
      if (result.status === "dismissed") {
        setLastError(result.lastError ?? "Payment was not completed.");
        return;
      }
      await verifyRazorpayPayment({
        orderId: order.id,
        razorpayPaymentId: result.razorpayPaymentId,
        razorpaySignature: result.razorpaySignature,
      }).catch(() => null);
      setLastError(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to retry payment");
    } finally {
      setRetrying(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-brand" /> : <p className="text-sm text-muted-foreground">Order not found.</p>}
      </div>
    );
  }

  const unpaid = order.status === "PLACED" && order.paymentMethod !== "COD" && order.paymentStatus !== "SUCCESS";
  const cancelled = order.status === "CANCELLED";
  const minutesLeft = Math.max(0, PAYMENT_WINDOW_MIN - Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        {/* Status banner */}
        <section className="rounded-2xl border border-border-soft bg-card p-6 text-center sm:p-8">
          {cancelled ? (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-500" strokeWidth={1.5} />
              <h1 className="mt-3 text-2xl font-semibold">Order cancelled</h1>
              <p className="mt-1 text-sm text-muted-foreground">The payment was not completed in time, so this order was cancelled. No money was taken.</p>
            </>
          ) : unpaid ? (
            <>
              <Clock className="mx-auto h-12 w-12 text-amber-500" strokeWidth={1.5} />
              <h1 className="mt-3 text-2xl font-semibold">Payment not completed</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your order is saved. Complete the payment within {minutesLeft} minute{minutesLeft === 1 ? "" : "s"} to confirm it — retrying never creates a second order.
              </p>
              {lastError ? <p className="mt-2 text-sm text-red-600">{lastError}</p> : null}
              <Button size="lg" className="mt-5 h-12 min-w-56" onClick={() => void handleRetry()} disabled={retrying || minutesLeft === 0}>
                {retrying ? "Opening payment…" : `Retry payment · ${formatInr(order.totalAmount)}`}
              </Button>
            </>
          ) : awaitingConfirmation ? (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand" />
              <h1 className="mt-3 text-2xl font-semibold">Confirming your payment…</h1>
              <p className="mt-1 text-sm text-muted-foreground">Payment received. This usually takes a few seconds.</p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" strokeWidth={1.5} />
              <h1 className="mt-3 text-2xl font-semibold">Order placed successfully!</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.paymentMethod === "COD"
                  ? `Please keep ${formatInr(order.totalAmount)} ready to pay on delivery.`
                  : "Your payment was successful."}{" "}
                A confirmation has been sent to your email.
              </p>
            </>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Order ID <span className="font-mono font-medium text-foreground">{order.id.slice(0, 8).toUpperCase()}</span> · {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          {order.estimatedDelivery && !unpaid && !cancelled ? (
            <p className="mt-2 text-sm font-medium text-foreground">
              Estimated delivery: {shortDate(order.estimatedDelivery.from)} – {shortDate(order.estimatedDelivery.to)}
            </p>
          ) : null}
        </section>

        {/* Items */}
        <section className="space-y-3 rounded-2xl border border-border-soft bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Items</h2>
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-mist">
                <Image src={item.image ?? PLACEHOLDER} alt="" fill sizes="56px" className="bg-white object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2">{item.productTitle ?? "Item"}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.color, item.size && item.size !== "Default" ? item.size : null].filter(Boolean).join(" / ")} · Qty {item.quantity}
                </p>
              </div>
              <p className="font-medium">{formatInr(item.priceSnapshot * item.quantity)}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="space-y-1 rounded-2xl border border-border-soft bg-card p-5 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Delivering to</h2>
            <p className="font-medium">{order.shippingName}</p>
            <p className="text-muted-foreground">{order.shippingAddressLine1}{order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}</p>
            <p className="text-muted-foreground">{order.shippingCity} – {order.shippingPincode}</p>
            <p className="text-muted-foreground">{order.shippingPhone}</p>
            {order.shippingNotes ? <p className="pt-1 text-xs">Note: {order.shippingNotes}</p> : null}
          </section>
          <section className="space-y-2 rounded-2xl border border-border-soft bg-card p-5 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Payment</h2>
            <Line label="Items" value={formatInr(order.charges.itemsTotal)} />
            {order.charges.couponDiscount > 0 ? <Line label={`Coupon ${order.charges.couponCode ?? ""}`} value={`−${formatInr(order.charges.couponDiscount)}`} /> : null}
            {order.charges.tax > 0 ? <Line label="GST" value={formatInr(order.charges.tax)} /> : null}
            {order.charges.platformFee ? <Line label="Platform fee" value={formatInr(order.charges.platformFee)} /> : null}
            <Line label="Delivery" value={order.charges.shipping > 0 ? formatInr(order.charges.shipping) : "FREE"} />
            <div className="h-px bg-border-soft" />
            <Line label={order.paymentMethod === "COD" ? "To pay on delivery" : "Total paid"} value={formatInr(order.charges.total)} bold />
          </section>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="h-12"><Link href={`/user/orders/${order.id}`}>Track order</Link></Button>
          <Button asChild size="lg" variant="outline" className="h-12"><Link href="/marketplace">Continue shopping</Link></Button>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
