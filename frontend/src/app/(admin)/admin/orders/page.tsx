"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminOrder,
  getOrders,
  cancelOrder,
  forceConfirmOrder,
} from "@/services/admin";
import { toast } from "sonner";

const getStatusStyle = (status: string) => {
  switch (status.toUpperCase()) {
    case "DELIVERED":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "CONFIRMED":
    case "SHIPPED":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "PLACED":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    case "CANCELLED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

export default function AdminOrdersPage() {
  const [loading, setLoading] = React.useState(true);
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [sellerFilter, setSellerFilter] = React.useState<string>("");
  const [productFilter, setProductFilter] = React.useState<string>("");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = React.useState<AdminOrder | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getOrders();
      setOrders(result.orders ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load orders"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async (id: string) => {
    setProcessingId(id);
    try {
      await cancelOrder(id);
      toast.success("Order cancelled.");
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel order"
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleForceConfirm = async (id: string) => {
    setProcessingId(id);
    try {
      await forceConfirmOrder(id);
      toast.success("Order force-confirmed.");
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to force-confirm order"
      );
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = orders.filter((o) => {
    const orderDate = new Date(o.createdAt);
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    const matchesDate = (!start || orderDate >= start) && (!end || orderDate <= end);

    const matchesSeller =
      !sellerFilter ||
      (o.items ?? []).some(
        (item) =>
          item.sellerId === sellerFilter ||
          item.sellerEmail === sellerFilter ||
          item.sellerName === sellerFilter
      );

    const matchesProduct =
      !productFilter ||
      (o.items ?? []).some(
        (item) =>
          item.productId === productFilter || item.productTitle === productFilter
      );

    const matchesSearch =
      !search.trim() ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      String(o.totalAmount).includes(search) ||
      o.userId.toLowerCase().includes(search.toLowerCase()) ||
      (o.buyerEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.buyerPhone ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.shippingName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.shippingPhone ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.shippingEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.shippingAddressLine1 ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.shippingAddressLine2 ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.shippingCity ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.shippingPincode ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.items ?? []).some(
        (item) =>
          item.sellerId.toLowerCase().includes(search.toLowerCase()) ||
          (item.sellerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (item.sellerEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
          item.productId.toLowerCase().includes(search.toLowerCase()) ||
          (item.productTitle ?? "").toLowerCase().includes(search.toLowerCase()) ||
          item.variantId.toLowerCase().includes(search.toLowerCase()) ||
          (item.variantSku ?? "").toLowerCase().includes(search.toLowerCase())
      );
    const matchesStatus =
      !statusFilter || o.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus && matchesSeller && matchesProduct && matchesDate;
  });

  const sellerOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) {
      for (const item of order.items ?? []) {
        const key = item.sellerName ?? item.sellerEmail ?? item.sellerId;
        map.set(key, key);
      }
    }
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const productOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) {
      for (const item of order.items ?? []) {
        const key = item.productTitle ?? item.productId;
        map.set(key, key);
      }
    }
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const copyText = async (label: string, value?: string | null) => {
    if (!value) {
      toast.error(`No ${label} available to copy`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label}`);
    }
  };

  const exportCsv = () => {
    const headers = [
      "order_id",
      "order_date",
      "status",
      "total_amount",
      "buyer_id",
      "buyer_email",
      "buyer_phone",
      "shipping_name",
      "shipping_phone",
      "shipping_email",
      "shipping_address_line_1",
      "shipping_address_line_2",
      "shipping_city",
      "shipping_pincode",
      "shipping_notes",
      "item_id",
      "product_id",
      "product_title",
      "variant_id",
      "variant_sku",
      "seller_id",
      "seller_name",
      "seller_email",
      "quantity",
      "unit_price",
      "line_total",
    ];

    const escapeCell = (value: unknown): string => {
      const str = value == null ? "" : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows: string[] = [headers.join(",")];

    for (const order of filtered) {
      const items = order.items ?? [];
      if (items.length === 0) {
        rows.push(
          [
            order.id,
            order.createdAt,
            order.status,
            order.totalAmount,
            order.userId,
            order.buyerEmail,
            order.buyerPhone,
            order.shippingName,
            order.shippingPhone,
            order.shippingEmail,
            order.shippingAddressLine1,
            order.shippingAddressLine2,
            order.shippingCity,
            order.shippingPincode,
            order.shippingNotes,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ]
            .map(escapeCell)
            .join(",")
        );
        continue;
      }

      for (const item of items) {
        rows.push(
          [
            order.id,
            order.createdAt,
            order.status,
            order.totalAmount,
            order.userId,
            order.buyerEmail,
            order.buyerPhone,
            order.shippingName,
            order.shippingPhone,
            order.shippingEmail,
            order.shippingAddressLine1,
            order.shippingAddressLine2,
            order.shippingCity,
            order.shippingPincode,
            order.shippingNotes,
            item.id,
            item.productId,
            item.productTitle,
            item.variantId,
            item.variantSku,
            item.sellerId,
            item.sellerName,
            item.sellerEmail,
            item.quantity,
            item.priceSnapshot,
            item.priceSnapshot * item.quantity,
          ]
            .map(escapeCell)
            .join(",")
        );
      }
    }

    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const statuses = ["", "PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

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
            Commerce Operations
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Order Management
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Review, cancel, or force-confirm platform orders with full administrative control.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              placeholder="Search by order, buyer, seller, product, SKU, pincode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 border border-border-soft bg-card px-3 text-sm text-foreground"
            >
              <option value="">All Statuses</option>
              {statuses.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="h-10 border border-border-soft bg-card px-3 text-sm text-foreground"
            >
              <option value="">All Sellers</option>
              {sellerOptions.map((seller) => (
                <option key={seller} value={seller}>
                  {seller}
                </option>
              ))}
            </select>

            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="h-10 border border-border-soft bg-card px-3 text-sm text-foreground"
            >
              <option value="">All Products</option>
              {productOptions.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10"
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        {/* Orders Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="border border-border-soft bg-card"
        >
          <div className="border-b border-border-soft p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Ledger
            </p>
            <p className="font-serif text-lg font-light text-foreground">
              All Orders ({filtered.length})
            </p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading orders...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No orders found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft">
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Order ID
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Amount
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Buyer
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Delivery Details
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Sold Products & Sellers
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Status
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Date
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {filtered.map((order, index) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 + index * 0.03, duration: 0.3 }}
                      className="hover:bg-mist/30 dark:hover:bg-navy/10 transition-colors duration-200"
                    >
                      <td className="p-6 font-mono text-xs font-medium text-foreground">
                        {order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="p-6 font-medium text-foreground">
                        ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                      </td>
                      <td className="p-6 text-muted-foreground">
                        <p className="text-foreground text-xs font-medium">
                          {order.buyerEmail ?? order.userId}
                        </p>
                        {order.buyerPhone ? (
                          <p className="text-xs">{order.buyerPhone}</p>
                        ) : null}
                      </td>
                      <td className="p-6 text-muted-foreground">
                        <p className="text-foreground text-xs font-medium">
                          {order.shippingName ?? "—"}
                        </p>
                        <p className="text-xs">
                          {order.shippingPhone ?? ""}
                          {order.shippingEmail ? ` · ${order.shippingEmail}` : ""}
                        </p>
                        <p className="text-xs">
                          {order.shippingAddressLine1 ?? ""}
                          {order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}
                          {order.shippingCity ? `, ${order.shippingCity}` : ""}
                          {order.shippingPincode ? ` - ${order.shippingPincode}` : ""}
                        </p>
                        {order.shippingNotes ? (
                          <p className="text-xs">Notes: {order.shippingNotes}</p>
                        ) : null}
                      </td>
                      <td className="p-6 text-muted-foreground min-w-[320px]">
                        <div className="space-y-3">
                          {(order.items ?? []).length === 0 ? (
                            <p className="text-xs">No items</p>
                          ) : (
                            (order.items ?? []).map((item) => (
                              <div key={item.id} className="rounded border border-border-soft p-3">
                                <p className="text-xs font-medium text-foreground">
                                  {item.productTitle ?? item.productId}
                                </p>
                                <p className="text-xs">
                                  SKU: {item.variantSku ?? item.variantId} · Qty {item.quantity}
                                </p>
                                <p className="text-xs">
                                  Seller: {item.sellerName ?? item.sellerEmail ?? item.sellerId}
                                </p>
                                <p className="text-xs">
                                  Unit: ₹{Number(item.priceSnapshot).toLocaleString("en-IN")} · Line: ₹{Number(item.priceSnapshot * item.quantity).toLocaleString("en-IN")}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-6">
                        <span
                          className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="p-6">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrder(order)}
                            className="h-9"
                          >
                            View Full Order
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(order.id)}
                            disabled={
                              order.status === "CANCELLED" ||
                              order.status === "DELIVERED" ||
                              processingId === order.id
                            }
                            className="h-9 text-muted-foreground hover:text-[#7A5656] hover:border-[#A67575]/40"
                          >
                            {processingId === order.id ? "Processing..." : "Cancel"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleForceConfirm(order.id)}
                            disabled={
                              order.status !== "PLACED" ||
                              processingId === order.id
                            }
                            className="h-9"
                          >
                            {processingId === order.id ? "Processing..." : "Force Confirm"}
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

        {selectedOrder ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border-soft bg-card p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Full Order Detail</p>
                  <h2 className="font-serif text-2xl text-foreground">{selectedOrder.id}</h2>
                </div>
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>Close</Button>
              </div>

              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-border-soft p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Order ID</p>
                    <p className="font-mono text-sm text-foreground break-all">{selectedOrder.id}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => copyText("Order ID", selectedOrder.id)}>Copy Order ID</Button>
                  </div>
                  <div className="border border-border-soft p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Buyer ID</p>
                    <p className="font-mono text-sm text-foreground break-all">{selectedOrder.userId}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => copyText("Buyer ID", selectedOrder.userId)}>Copy Buyer ID</Button>
                  </div>
                </div>

                <div className="border border-border-soft p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Buyer Contact</p>
                  <p className="text-sm text-foreground">{selectedOrder.buyerEmail ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.buyerPhone ?? "—"}</p>
                </div>

                <div className="border border-border-soft p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Shipping Address</p>
                  <p className="text-sm text-foreground">{selectedOrder.shippingName ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.shippingPhone ?? ""}
                    {selectedOrder.shippingEmail ? ` · ${selectedOrder.shippingEmail}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {[selectedOrder.shippingAddressLine1, selectedOrder.shippingAddressLine2, selectedOrder.shippingCity, selectedOrder.shippingPincode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  {selectedOrder.shippingNotes ? <p className="text-sm text-muted-foreground">Notes: {selectedOrder.shippingNotes}</p> : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() =>
                      copyText(
                        "Shipping Address",
                        [
                          selectedOrder.shippingName,
                          selectedOrder.shippingPhone,
                          selectedOrder.shippingEmail,
                          selectedOrder.shippingAddressLine1,
                          selectedOrder.shippingAddressLine2,
                          selectedOrder.shippingCity,
                          selectedOrder.shippingPincode,
                          selectedOrder.shippingNotes,
                        ]
                          .filter(Boolean)
                          .join("\n")
                      )
                    }
                  >
                    Copy Full Address
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Sold Products</p>
                  {(selectedOrder.items ?? []).map((item) => (
                    <div key={item.id} className="border border-border-soft p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.productTitle ?? item.productId}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.variantSku ?? item.variantId}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => copyText("Product ID", item.productId)}>
                          Copy Product ID
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Seller: {item.sellerName ?? item.sellerEmail ?? item.sellerId}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} · Unit: ₹{Number(item.priceSnapshot).toLocaleString("en-IN")} · Line: ₹{Number(item.priceSnapshot * item.quantity).toLocaleString("en-IN")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
