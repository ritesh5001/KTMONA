"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  markNotificationRead,
  type AppNotification,
} from "@/services/notifications";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeLabel: Record<string, string> = {
  ORDER_PLACED: "Order Placed",
  SHIPMENT_CREATED: "Shipment Created",
  ORDER_SHIPPED: "Shipped",
  ORDER_DELIVERED: "Delivered",
  PAYMENT_SUCCESS: "Payment Confirmed",
  PAYMENT_FAILED: "Payment Failed",
  SELLER_NEW_ORDER: "New Order",
  SELLER_APPROVED: "Seller Approved",
  SELLER_PRODUCT_APPROVED: "Product Approved",
  SELLER_PRODUCT_REJECTED: "Product Rejected",
  ADMIN_ALERT: "Alert",
};

const typeIcon: Record<string, string> = {
  ORDER_PLACED: "📦",
  SHIPMENT_CREATED: "📬",
  ORDER_SHIPPED: "🚚",
  ORDER_DELIVERED: "✅",
  PAYMENT_SUCCESS: "💳",
  PAYMENT_FAILED: "❌",
  SELLER_NEW_ORDER: "🛒",
  SELLER_APPROVED: "🎉",
  SELLER_PRODUCT_APPROVED: "✔️",
  SELLER_PRODUCT_REJECTED: "✖️",
  ADMIN_ALERT: "⚠️",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function notificationHref(n: AppNotification): string | null {
  const orderId = n.meta?.orderId;
  if (!orderId) return null;
  switch (n.type) {
    case "ORDER_PLACED":
    case "SHIPMENT_CREATED":
    case "ORDER_SHIPPED":
    case "ORDER_DELIVERED":
    case "PAYMENT_SUCCESS":
    case "PAYMENT_FAILED":
      return `/user/orders/${orderId}`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // ---- Fetch list ----
  const fetchPage = React.useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listNotifications(pageNum, PAGE_SIZE);
      setItems(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
      setPage(pageNum);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  // ---- Mark read ----
  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      toast.error("Failed to mark notification as read");
    }
  };

  // ---- Pagination ----
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  // ---- Render ----
  return (
    <div className="w-full max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foreground tracking-tight">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay updated on your orders and account activity.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-sm bg-mist/60 dark:bg-navy/20"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fetchPage(page)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No notifications yet.
          </p>
        </div>
      )}

      {/* List */}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-2">
          {items.map((n) => {
            const href = notificationHref(n);
            const label = typeLabel[n.type] ?? n.type;
            const icon = typeIcon[n.type] ?? "🔔";

            const inner = (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group flex items-start gap-4 rounded-sm border px-5 py-4 transition-colors ${
                  n.isRead
                    ? "border-border-soft bg-background"
                    : "border-brand/20 bg-brand/[0.03]"
                }`}
              >
                <span className="mt-0.5 text-lg">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {label}
                    </span>
                    {!n.isRead && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-foreground line-clamp-2">
                    {n.message}
                  </p>
                  <span className="mt-1 block text-[11px] text-muted-foreground/70">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>

                {!n.isRead && (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleMarkRead(n.id);
                    }}
                  >
                    Mark read
                  </button>
                )}
              </motion.div>
            );

            return href ? (
              <Link key={n.id} href={href} onClick={() => !n.isRead && handleMarkRead(n.id)}>
                {inner}
              </Link>
            ) : (
              <div key={n.id} onClick={() => !n.isRead && handleMarkRead(n.id)} className="cursor-default">
                {inner}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => fetchPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => fetchPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
