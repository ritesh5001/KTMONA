"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { approveCancellationAsSeller, listSellerOrders } from "@/services/orders";
import {
  createShipment,
  listSellerShipments,
  markShipmentDelivered,
  markShipmentShipped,
} from "@/services/shipments";
import { useLiveFreshness } from "@/hooks/use-live-freshness";
import { useHydratedSWR } from "@/hooks/use-hydrated-swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface SellerOrdersInitialData {
  orderItems: Array<any>;
  shipmentsByOrder: Record<string, Array<any>>;
}

export default function SellerOrdersClient({
  initialData,
}: {
  initialData?: SellerOrdersInitialData | null;
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [shipmentForm, setShipmentForm] = React.useState<
    Record<string, { carrier: string; trackingNumber: string }>
  >({});

  const fetchOrdersData = React.useCallback(async () => {
    const [ordersResult, shipmentsResult] = await Promise.all([
      listSellerOrders(),
      listSellerShipments(),
    ]);

    const shipments = shipmentsResult.data?.shipments ?? [];
    const grouped = shipments.reduce((acc, shipment) => {
      const orderId = shipment.orderId;
      acc[orderId] = acc[orderId] ? [...acc[orderId], shipment] : [shipment];
      return acc;
    }, {} as Record<string, Array<any>>);

    return {
      orderItems: ordersResult.orderItems ?? [],
      shipmentsByOrder: grouped,
    } satisfies SellerOrdersInitialData;
  }, []);

  const {
    data: ordersData,
    isLoading,
    mutate,
  } = useHydratedSWR<SellerOrdersInitialData>({
    key: "seller-orders:hydrated",
    fetcher: fetchOrdersData,
    fallbackData: initialData ?? undefined,
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to load orders"
      );
    },
  });

  const items = React.useMemo(() => ordersData?.orderItems ?? [], [ordersData?.orderItems]);
  const shipmentsByOrder = React.useMemo(
    () => ordersData?.shipmentsByOrder ?? {},
    [ordersData?.shipmentsByOrder]
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

  const filteredItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const orderStatus = item.order?.status ?? "";
      if (statusFilter !== "ALL" && orderStatus !== statusFilter) {
        return false;
      }

      if (!query) return true;

      const shipment = shipmentsByOrder[item.order?.id ?? ""]?.[0];
      const haystack = [
        item.productTitle,
        item.variantSku,
        item.order?.id,
        item.order?.shippingName,
        item.order?.shippingPhone,
        item.order?.shippingEmail,
        item.order?.shippingAddressLine1,
        item.order?.shippingAddressLine2,
        item.order?.shippingCity,
        item.order?.shippingPincode,
        shipment?.trackingNumber,
        shipment?.carrier,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [items, searchQuery, statusFilter, shipmentsByOrder]);

  const handleCreateShipment = async (orderId: string) => {
    const payload = shipmentForm[orderId];
    if (!payload?.carrier || !payload?.trackingNumber) {
      toast.error("Enter carrier and tracking number.");
      return;
    }
    try {
      const result = await createShipment(orderId, payload);
      toast.success("Shipment created.");
      setShipmentForm((prev) => ({
        ...prev,
        [orderId]: { carrier: "", trackingNumber: "" },
      }));
      await mutate(
        (current) => ({
          orderItems: current?.orderItems ?? [],
          shipmentsByOrder: {
            ...(current?.shipmentsByOrder ?? {}),
            [orderId]: [result.data],
          },
        }),
        false
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create shipment"
      );
    }
  };

  const handleMarkShipped = async (shipmentId: string, orderId: string) => {
    try {
      const result = await markShipmentShipped(shipmentId);
      toast.success("Marked as shipped.");
      await mutate(
        (current) => ({
          orderItems: current?.orderItems ?? [],
          shipmentsByOrder: {
            ...(current?.shipmentsByOrder ?? {}),
            [orderId]: [result.data],
          },
        }),
        false
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update shipment"
      );
    }
  };

  const handleMarkDelivered = async (shipmentId: string, orderId: string) => {
    try {
      const result = await markShipmentDelivered(shipmentId);
      toast.success("Marked as delivered.");
      await mutate(
        (current) => ({
          orderItems: current?.orderItems ?? [],
          shipmentsByOrder: {
            ...(current?.shipmentsByOrder ?? {}),
            [orderId]: [result.data],
          },
        }),
        false
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update shipment"
      );
    }
  };

  const handleApproveCancellation = async (orderId: string, cancellationId: string) => {
    try {
      const result = await approveCancellationAsSeller(cancellationId);
      await mutate(
        (current) => ({
          orderItems:
            current?.orderItems.map((item) =>
              item.order?.id === orderId
                ? {
                    ...item,
                    order: {
                      ...item.order,
                      status: "CANCELLED",
                      cancellationRequest: item.order?.cancellationRequest
                        ? {
                            ...item.order.cancellationRequest,
                            status: "APPROVED",
                          }
                        : item.order?.cancellationRequest,
                    },
                  }
                : item
            ) ?? [],
          shipmentsByOrder: current?.shipmentsByOrder ?? {},
        }),
        false
      );
      toast.success(
        result.refundTriggered
          ? "Cancellation approved. Refund initiated automatically."
          : "Cancellation approved."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to approve cancellation"
      );
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Order Management
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Fulfillment Center
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Process and track incoming orders. Manage shipments with care and precision.
          </p>
        </div>

        {/* Filters - Concierge Style */}
        <div className="border border-border-soft bg-card p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search orders, customer, tracking..."
            className="md:max-w-md h-12"
          />
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Status
            </span>
            <select
              className="h-10 px-4 border border-border-soft bg-card text-sm text-foreground outline-none transition focus:border-brand"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All Orders</option>
              <option value="PLACED">Placed</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Orders List */}
        <section className="space-y-4">
          {loading ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Loading orders...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center border border-border-soft bg-card">
              <p className="text-sm text-muted-foreground">
                No orders assigned yet.
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const orderId = item.order?.id as string;
              const shipment = shipmentsByOrder[orderId]?.[0];
              const cancellationRequest = item.order?.cancellationRequest;
              const cancellationRequested = cancellationRequest?.status === "REQUESTED";
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                  className="border border-border-soft bg-card"
                >
                  {/* Shipping Info */}
                  <div className="grid gap-6 p-6 sm:grid-cols-2 border-b border-border-soft">
                    <div className="space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                        Ship To
                      </p>
                      <p className="font-medium text-foreground">
                        {item.order?.shippingName ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.order?.shippingPhone ?? ""}
                        {item.order?.shippingEmail
                          ? ` · ${item.order.shippingEmail}`
                          : ""}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                        Address
                      </p>
                      <p className="font-medium text-foreground">
                        {item.order?.shippingAddressLine1 ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.order?.shippingAddressLine2 ?? ""}
                        {item.order?.shippingCity
                          ? `, ${item.order.shippingCity}`
                          : ""}
                        {item.order?.shippingPincode
                          ? ` - ${item.order.shippingPincode}`
                          : ""}
                      </p>
                    </div>
                    {item.order?.shippingNotes ? (
                      <div className="sm:col-span-2 space-y-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Delivery Notes
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.order.shippingNotes}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Order Item */}
                  <div className="p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 py-4 px-5 border border-border-soft bg-mist/30 dark:bg-navy/10">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {item.productTitle ?? "Order item"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.variantSku ?? "—"} · Qty {item.quantity}
                        </p>
                      </div>
                      <span className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider border border-border-soft text-muted-foreground">
                        {item.order?.status ?? "PLACED"}
                      </span>
                    </div>

                    {cancellationRequest ? (
                      <div className="space-y-3 p-5 border border-border-soft bg-rose-50/30 dark:bg-rose-900/10">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
                            Cancellation Request • {cancellationRequest.status}
                          </p>
                          {cancellationRequested ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleApproveCancellation(orderId, cancellationRequest.id)
                              }
                            >
                              Approve Cancellation
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {cancellationRequest.reason}
                        </p>
                      </div>
                    ) : null}

                    {/* Shipment Section */}
                    {shipment ? (
                      <div className="flex flex-wrap items-center justify-between gap-4 p-5 border border-border-soft">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {shipment.carrier} · {shipment.trackingNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status: {shipment.status}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {shipment.status === "CREATED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkShipped(shipment.id, orderId)}
                            >
                              Mark Shipped
                            </Button>
                          ) : null}
                          {shipment.status === "SHIPPED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkDelivered(shipment.id, orderId)}
                            >
                              Mark Delivered
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 p-5 border border-dashed border-border-soft">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Create Shipment
                        </p>
                        {cancellationRequested ? (
                          <p className="text-xs text-rose-700 dark:text-rose-300">
                            Shipment is blocked while cancellation request is pending.
                          </p>
                        ) : null}
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Input
                            placeholder="Carrier name"
                            value={shipmentForm[orderId]?.carrier ?? ""}
                            onChange={(event) =>
                              setShipmentForm((prev) => ({
                                ...prev,
                                [orderId]: {
                                  carrier: event.target.value,
                                  trackingNumber: prev[orderId]?.trackingNumber ?? "",
                                },
                              }))
                            }
                          />
                          <Input
                            placeholder="Tracking number"
                            value={shipmentForm[orderId]?.trackingNumber ?? ""}
                            onChange={(event) =>
                              setShipmentForm((prev) => ({
                                ...prev,
                                [orderId]: {
                                  carrier: prev[orderId]?.carrier ?? "",
                                  trackingNumber: event.target.value,
                                },
                              }))
                            }
                          />
                          <Button
                            onClick={() => handleCreateShipment(orderId)}
                            disabled={cancellationRequested}
                          >
                            Create Shipment
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </section>
      </motion.div>
    </div>
  );
}
