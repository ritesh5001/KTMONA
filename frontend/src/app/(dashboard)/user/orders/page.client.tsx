"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listBuyerOrders, downloadInvoice } from "@/services/orders";
import { retryPayment, verifyPhonePePayment } from "@/services/payments";
import { listMyCancellations, requestCancellation } from "@/services/cancellations";
import { listMyReturns, requestReturn } from "@/services/returns";
import { useLiveFreshness } from "@/hooks/use-live-freshness";
import { useHydratedSWR } from "@/hooks/use-hydrated-swr";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const getStatusStyle = (status: string) => {
  // Calm, desaturated status colors - never loud
  switch (status.toUpperCase()) {
    case "DELIVERED":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "CONFIRMED":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    case "SHIPPED":
      return "border-[#8B9CB8]/30 text-[#5E6B82] bg-[#8B9CB8]/5";
    case "PLACED":
      return "border-border-soft text-muted-foreground bg-mist/30";
    case "PAYMENT PENDING":
      return "border-[#FF8A00]/40 text-[#B84A00] bg-[#FF8A00]/10";
    case "PAYMENT FAILED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    case "CANCELLED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

export interface UserOrdersInitialData {
  orders: Array<any>;
  cancellationByOrderId: Record<string, { id: string; status: string }>;
  returnByOrderId: Record<string, { id: string; status: string }>;
  paymentStatusByOrder: Record<string, string>;
}

export default function UserOrdersClient({
  initialData,
}: {
  initialData?: UserOrdersInitialData | null;
}) {
  const [requestingCancellationIds, setRequestingCancellationIds] = React.useState<Set<string>>(new Set());
  const [cancelModalOrderId, setCancelModalOrderId] = React.useState<string | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [returnModalOrderId, setReturnModalOrderId] = React.useState<string | null>(null);
  const [returnReason, setReturnReason] = React.useState("");
  const [requestingReturnIds, setRequestingReturnIds] = React.useState<Set<string>>(new Set());
  const [downloadingInvoiceId, setDownloadingInvoiceId] = React.useState<string | null>(null);

  const fetchUserOrdersData = React.useCallback(async () => {
    const result = await listBuyerOrders();
    const nextOrders = result.orders ?? [];

    let cancellationByOrderId: Record<string, { id: string; status: string }> = {};
    try {
      const cancellationResult = await listMyCancellations();
      cancellationByOrderId = (cancellationResult.cancellations ?? []).reduce(
        (acc, cancellation) => {
          acc[cancellation.orderId] = {
            id: cancellation.id,
            status: cancellation.status,
          };
          return acc;
        },
        {} as Record<string, { id: string; status: string }>
      );
    } catch {
      cancellationByOrderId = {};
    }

    let returnByOrderId: Record<string, { id: string; status: string }> = {};
    try {
      const returnResult = await listMyReturns();
      returnByOrderId = (returnResult.returns ?? []).reduce((acc, ret) => {
        acc[ret.orderId] = { id: ret.id, status: ret.status };
        return acc;
      }, {} as Record<string, { id: string; status: string }>);
    } catch {
      returnByOrderId = {};
    }

    const paymentStatusByOrder = nextOrders.reduce((acc, order: any) => {
      acc[order.id] = order.paymentStatus ?? "";
      return acc;
    }, {} as Record<string, string>);

    return {
      orders: nextOrders,
      cancellationByOrderId,
      returnByOrderId,
      paymentStatusByOrder,
    } satisfies UserOrdersInitialData;
  }, []);

  const { data: ordersData, isLoading, mutate } = useHydratedSWR<UserOrdersInitialData>({
    key: "user-orders:hydrated",
    fetcher: fetchUserOrdersData,
    fallbackData: initialData ?? undefined,
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to load orders"
      );
    },
  });

  const orders = React.useMemo(() => ordersData?.orders ?? [], [ordersData]);
  const cancellationByOrderId = ordersData?.cancellationByOrderId ?? {};
  const returnByOrderId = ordersData?.returnByOrderId ?? {};
  const paymentStatusByOrder = React.useMemo(
    () => ordersData?.paymentStatusByOrder ?? {},
    [ordersData]
  );
  const loading = isLoading && !ordersData;

  const liveRefreshBlockRef = React.useRef<number>(0);

  useLiveFreshness({
    eventTypes: ["order.updated", "shipment.updated", "payment.updated"],
    onEvent: () => {
      const now = Date.now();
      if (now - liveRefreshBlockRef.current < 600) return;
      liveRefreshBlockRef.current = now;
      void mutate();
    },
  });

  // ---- Self-heal pending PhonePe payments ----
  // If a buyer paid but never hit the callback (e.g. PhonePe dropped the return
  // param), the order sits PLACED/PENDING. On load, reconcile each pending
  // order against PhonePe's status API via the backend.
  const healedRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const pending = orders.filter((o: any) => {
      const status = paymentStatusByOrder[o.id];
      // Cash on Delivery has no PhonePe payment to reconcile.
      if (o.paymentMethod === "COD") return false;
      return status && status !== "SUCCESS" && status !== "FAILED" && !healedRef.current.has(o.id);
    });
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      let anyConfirmed = false;
      for (const order of pending) {
        healedRef.current.add(order.id);
        try {
          const res = await verifyPhonePePayment(order.id);
          if (res.data.status === "SUCCESS" || res.data.status === "FAILED") {
            anyConfirmed = true;
          }
        } catch {
          // No PhonePe attempt for this order, or nothing to reconcile — ignore.
        }
      }
      if (anyConfirmed && !cancelled) void mutate();
    })();

    return () => {
      cancelled = true;
    };
  }, [orders, paymentStatusByOrder, mutate]);

  // ---- Retry payment (redirect back to PhonePe) ----
  const [retryingOrderId, setRetryingOrderId] = React.useState<string | null>(null);
  const handleRetryPayment = React.useCallback(async (orderId: string) => {
    if (retryingOrderId) return;
    setRetryingOrderId(orderId);
    try {
      const result = await retryPayment(orderId);
      const redirectUrl = result.data.redirectUrl;
      if (!redirectUrl) {
        throw new Error("Payment could not be started. Please try again.");
      }
      try {
        window.sessionStorage.setItem("ktmona_pending_order", orderId);
      } catch {
        // Non-fatal.
      }
      window.location.assign(redirectUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to retry payment");
      setRetryingOrderId(null);
    }
  }, [retryingOrderId]);

  const openCancellationModal = React.useCallback((orderId: string) => {
    setCancelModalOrderId(orderId);
    setCancelReason("");
  }, []);

  const closeCancellationModal = React.useCallback(() => {
    setCancelModalOrderId(null);
    setCancelReason("");
  }, []);

  const handleRequestCancellation = React.useCallback(async () => {
    if (!cancelModalOrderId) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Please enter a cancellation reason");
      return;
    }

    setRequestingCancellationIds((prev) => new Set(prev).add(cancelModalOrderId));
    try {
      await requestCancellation(cancelModalOrderId, reason);
      await mutate(
        (current) => ({
          orders: current?.orders ?? [],
          cancellationByOrderId: {
            ...(current?.cancellationByOrderId ?? {}),
            [cancelModalOrderId]: {
              id: `temp-${cancelModalOrderId}`,
              status: "REQUESTED",
            },
          },
          returnByOrderId: current?.returnByOrderId ?? {},
          paymentStatusByOrder: current?.paymentStatusByOrder ?? {},
        }),
        false
      );
      toast.success("Cancellation requested successfully");
      closeCancellationModal();
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request cancellation");
    } finally {
      setRequestingCancellationIds((prev) => {
        const next = new Set(prev);
        next.delete(cancelModalOrderId);
        return next;
      });
    }
  }, [cancelModalOrderId, cancelReason, closeCancellationModal, mutate]);

  // ---- Return handlers ----
  const openReturnModal = React.useCallback((orderId: string) => {
    setReturnModalOrderId(orderId);
    setReturnReason("");
  }, []);

  const closeReturnModal = React.useCallback(() => {
    setReturnModalOrderId(null);
    setReturnReason("");
  }, []);

  const handleRequestReturn = React.useCallback(async () => {
    if (!returnModalOrderId) return;
    const reason = returnReason.trim();
    if (!reason) {
      toast.error("Please enter a return reason");
      return;
    }

    const order = orders.find((o: any) => o.id === returnModalOrderId);
    if (!order?.items?.length) {
      toast.error("No items found for this order");
      return;
    }

    // Return all items by default (full return)
    const items = (order.items as any[]).map((item: any) => ({
      orderItemId: item.id,
      quantity: item.quantity,
    }));

    setRequestingReturnIds((prev) => new Set(prev).add(returnModalOrderId));
    try {
      await requestReturn(returnModalOrderId, reason, items);
      await mutate(
        (current) => ({
          orders: current?.orders ?? [],
          cancellationByOrderId: current?.cancellationByOrderId ?? {},
          returnByOrderId: {
            ...(current?.returnByOrderId ?? {}),
            [returnModalOrderId]: { id: `temp-${returnModalOrderId}`, status: "REQUESTED" },
          },
          paymentStatusByOrder: current?.paymentStatusByOrder ?? {},
        }),
        false
      );
      toast.success("Return requested successfully");
      closeReturnModal();
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request return");
    } finally {
      setRequestingReturnIds((prev) => {
        const next = new Set(prev);
        next.delete(returnModalOrderId);
        return next;
      });
    }
  }, [returnModalOrderId, returnReason, orders, closeReturnModal, mutate]);

  // ---- Download Invoice handler ----
  const handleDownloadInvoice = React.useCallback(async (orderId: string) => {
    if (downloadingInvoiceId) return;
    setDownloadingInvoiceId(orderId);
    try {
      await downloadInvoice(orderId);
      toast.success("Invoice downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download invoice");
    } finally {
      setDownloadingInvoiceId(null);
    }
  }, [downloadingInvoiceId]);

  return (
    <>
    <div className="min-h-[50vh]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex w-full flex-col gap-8"
      >
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Order History
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Your Purchases
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Track every order from our verified sellers to your doorstep.
          </p>
        </div>

        {/* Orders List */}
        <section className="space-y-6">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading your orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Your order history is waiting to be written.
              </p>
              <Link href="/marketplace">
                <Button>Discover Collections</Button>
              </Link>
            </div>
          ) : (
            orders.map((order, index) => {
              const paymentStatus = paymentStatusByOrder[order.id];
              const saleSubtotal = (order.items ?? []).reduce(
                (sum: number, item: any) =>
                  sum + (item.priceSnapshot ?? 0) * (item.quantity ?? 0),
                0
              );
              const regularSubtotal = (order.items ?? []).reduce(
                (sum: number, item: any) =>
                  sum +
                  ((item.sellerPriceSnapshot ?? item.priceSnapshot ?? 0) *
                    (item.quantity ?? 0)),
                0
              );
              const shippingAmount = Math.max((order.totalAmount ?? 0) - saleSubtotal, 0);
              const regularGrandTotal = regularSubtotal + shippingAmount;
              let label = order.status;
              const cancellationStatus =
                cancellationByOrderId[order.id]?.status ?? order.cancellationRequest?.status;
              const hasCancellationRequest = cancellationStatus === "REQUESTED";
              const shipmentStatus = order.shipmentStatus ?? null;
              const canRequestCancellation =
                (order.status === "PLACED" || order.status === "CONFIRMED") &&
                shipmentStatus !== "SHIPPED" &&
                !hasCancellationRequest;
              const requestingCancellation = requestingCancellationIds.has(order.id);
              // Return eligibility
              const returnStatus = returnByOrderId[order.id]?.status;
              const hasReturnRequest = !!returnStatus && returnStatus !== "REJECTED";
              const canRequestReturn =
                order.status === "DELIVERED" && !hasReturnRequest;
              const requestingReturn = requestingReturnIds.has(order.id);
              if (order.status === "PLACED") {
                if (paymentStatus === "FAILED") {
                  label = "PAYMENT FAILED";
                } else if (paymentStatus && paymentStatus !== "SUCCESS") {
                  label = "PAYMENT PENDING";
                }
              }

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05, duration: 0.5 }}
                  className="border border-border-soft bg-card"
                >
                  {/* Order Header */}
                  <div className="flex flex-col gap-4 p-6 border-b border-border-soft sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="font-serif text-lg font-normal text-foreground">
                        Order {order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {order.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(label)}`}>
                        {label}
                      </span>
                      {hasCancellationRequest ? (
                        <span className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border border-brand/30 text-[#B84A00] bg-brand/5">
                          Cancellation Requested
                        </span>
                      ) : null}
                      {canRequestCancellation ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={requestingCancellation}
                          onClick={() => openCancellationModal(order.id)}
                        >
                          {requestingCancellation ? "Requesting..." : "Request Cancellation"}
                        </Button>
                      ) : null}
                      {hasReturnRequest ? (
                        <span className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border border-[#8B9CB8]/30 text-[#5E6B82] bg-[#8B9CB8]/5">
                          Return {returnStatus}
                        </span>
                      ) : null}
                      {canRequestReturn ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={requestingReturn}
                          onClick={() => openReturnModal(order.id)}
                        >
                          {requestingReturn ? "Requesting..." : "Request Return"}
                        </Button>
                      ) : null}
                      {/* Retry Payment — for unpaid PLACED orders */}
                      {(label === "PAYMENT PENDING" || label === "PAYMENT FAILED") && (
                        <Button
                          size="sm"
                          disabled={retryingOrderId === order.id}
                          onClick={() => handleRetryPayment(order.id)}
                        >
                          {retryingOrderId === order.id ? "Redirecting..." : "Retry Payment"}
                        </Button>
                      )}
                      {/* Download Invoice — available for confirmed/shipped/delivered orders */}
                      {(order.status === "CONFIRMED" || order.status === "SHIPPED" || order.status === "DELIVERED") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={downloadingInvoiceId === order.id}
                          onClick={() => handleDownloadInvoice(order.id)}
                        >
                          {downloadingInvoiceId === order.id ? "Downloading..." : "Download Invoice"}
                        </Button>
                      )}
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/user/orders/${order.id}`}>
                          Track Order
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="grid gap-px bg-border-soft sm:grid-cols-3">
                    <div className="bg-card p-6 space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Placed On
                      </p>
                      <p className="font-medium text-foreground">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-card p-6 space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Items
                      </p>
                      <p className="font-medium text-foreground">
                        {order.items?.length ?? 0} {order.items?.length === 1 ? "piece" : "pieces"}
                      </p>
                    </div>
                    <div className="bg-card p-6 space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Total
                      </p>
                      <div className="space-y-1">
                        <p className="font-serif text-lg font-light text-foreground">
                          {currency.format(order.totalAmount ?? 0)}
                        </p>
                        {regularGrandTotal !== (order.totalAmount ?? 0) ? (
                          <p className="text-xs text-muted-foreground line-through">
                            {currency.format(regularGrandTotal)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Order Summary Footer */}
                  <div className="p-6 border-t border-border-soft">
                    <div className="grid gap-6 sm:grid-cols-3 text-sm">
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Subtotal
                        </p>
                        <p className="text-foreground">
                          {currency.format(saleSubtotal)}
                        </p>
                        {regularSubtotal !== saleSubtotal ? (
                          <p className="text-xs text-muted-foreground line-through">
                            {currency.format(regularSubtotal)}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Shipping
                        </p>
                        <p className="text-foreground">
                          {currency.format(shippingAmount)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Grand Total
                        </p>
                        <p className="font-medium text-foreground">
                          {currency.format(order.totalAmount ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </section>
      </motion.div>
    </div>

      {cancelModalOrderId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md border border-border-soft bg-card p-6 space-y-4">
            <h2 className="font-serif text-xl text-foreground">Request Cancellation</h2>
            <p className="text-sm text-muted-foreground">
              Please share the reason for cancelling this order.
            </p>
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Enter your cancellation reason"
              className="min-h-30"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeCancellationModal}>
                Close
              </Button>
              <Button
                onClick={handleRequestCancellation}
                disabled={!cancelReason.trim() || requestingCancellationIds.has(cancelModalOrderId)}
              >
                {requestingCancellationIds.has(cancelModalOrderId) ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {returnModalOrderId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md border border-border-soft bg-card p-6 space-y-4">
            <h2 className="font-serif text-xl text-foreground">Request Return</h2>
            <p className="text-sm text-muted-foreground">
              Please share the reason for returning this order. All items will be included.
            </p>
            <Textarea
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Enter your return reason (e.g., wrong size, damaged item)"
              className="min-h-30"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeReturnModal}>
                Close
              </Button>
              <Button
                onClick={handleRequestReturn}
                disabled={!returnReason.trim() || requestingReturnIds.has(returnModalOrderId)}
              >
                {requestingReturnIds.has(returnModalOrderId) ? "Submitting..." : "Submit Return"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
