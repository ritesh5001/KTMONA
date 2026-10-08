"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import useSWR from "swr";
import {
  listNotifications,
  markNotificationRead,
  getUnreadCount,
  type AppNotification,
} from "@/services/notifications";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const relativeTime = (isoDate: string) => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function notificationIcon(type: string) {
  const t = type.toUpperCase();
  if (t.includes("ORDER")) return "📦";
  if (t.includes("SHIPMENT") || t.includes("SHIP")) return "🚚";
  if (t.includes("CANCEL")) return "❌";
  if (t.includes("REFUND") || t.includes("RETURN")) return "💸";
  if (t.includes("PAYMENT") || t.includes("SETTLE")) return "💰";
  if (t.includes("PRODUCT") || t.includes("APPROV")) return "✅";
  if (t.includes("STOCK") || t.includes("INVENTORY")) return "📊";
  return "🔔";
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="flex gap-4 border-b border-border-soft px-6 py-5">
      <div className="h-8 w-8 animate-pulse bg-border-soft dark:bg-border" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-48 animate-pulse bg-border-soft dark:bg-border" />
        <div className="h-3 w-72 animate-pulse bg-border-soft dark:bg-border" />
      </div>
      <div className="h-3 w-12 animate-pulse bg-border-soft dark:bg-border" />
    </div>
  );
}

const EASE = [0.25, 0.1, 0.25, 1] as const;
const PAGE_SIZE = 20;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SellerNotificationsPage() {
  const [notifications, setNotifications] = React.useState<AppNotification[]>(
    []
  );
  const [total, setTotal] = React.useState(0);
  const { data: unreadCount = 0, mutate: mutateUnread } = useSWR(
    "seller-unread-count",
    getUnreadCount,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 }
  );
  const setUnreadCount = React.useCallback(
    (next: number | ((current: number) => number)) => {
      void mutateUnread(
        (current = 0) => (typeof next === "function" ? next(current) : next),
        { revalidate: false }
      );
    },
    [mutateUnread]
  );
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"ALL" | "UNREAD">("ALL");

  const loadNotifications = React.useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        // The badge count shares SellerShell's "seller-unread-count" SWR key, so
        // it comes from cache rather than a second request for the same number.
        const result = await listNotifications(p, PAGE_SIZE);
        setNotifications(result.data ?? []);
        setTotal(result.meta?.total ?? 0);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to load notifications"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    loadNotifications(page);
  }, [page, loadNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to mark as read"
      );
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map((n) => markNotificationRead(n.id)));
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to mark all as read"
      );
    }
  };

  const displayed = React.useMemo(() => {
    if (filter === "UNREAD") return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [notifications, filter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
      >
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
              Notifications
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Activity Feed
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Order updates, shipment alerts, and important seller
              notifications.
              {unreadCount > 0 && (
                <span className="ml-2 font-medium text-foreground">
                  {unreadCount} unread
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              Mark All Read
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border border-border-soft p-0.5 w-fit">
          {(["ALL", "UNREAD"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-[11px] font-medium uppercase tracking-wide transition-all duration-300 ${
                filter === f
                  ? "bg-ink text-paper dark:bg-brand dark:text-ink"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "ALL" ? `All (${total})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div className="border border-border-soft bg-card">
          {loading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {filter === "UNREAD"
                  ? "No unread notifications."
                  : "No notifications yet."}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {displayed.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    delay: i * 0.02,
                    duration: 0.3,
                  }}
                  className={`flex gap-4 border-b border-border-soft px-6 py-5 transition-colors ${
                    n.isRead
                      ? "hover:bg-mist/30 dark:hover:bg-navy/10"
                      : "bg-brand/3 hover:bg-brand/6"
                  }`}
                >
                  {/* Icon */}
                  <div className="flex h-9 w-9 items-center justify-center border border-border-soft text-sm shrink-0">
                    {notificationIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm ${
                          n.isRead
                            ? "text-muted-foreground"
                            : "font-medium text-foreground"
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {n.message}
                    </p>
                    {n.meta?.orderId && (
                      <p className="text-[11px] text-brand-strong">
                        Order: {n.meta.orderId.slice(0, 12)}…
                      </p>
                    )}
                  </div>

                  {/* Mark read */}
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 self-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Mark Read
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-soft px-6 py-3">
              <p className="text-[11px] text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
