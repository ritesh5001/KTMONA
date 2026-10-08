"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { AdminNotification, getAdminNotifications } from "@/services/admin";
import { toast } from "sonner";

const getStatusStyle = (status: string) => {
  switch (status.toUpperCase()) {
    case "SENT":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "PENDING":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    case "FAILED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

export default function AdminNotificationsPage() {
  const [loading, setLoading] = React.useState(true);
  const [notifications, setNotifications] = React.useState<AdminNotification[]>([]);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminNotifications({ page, limit: 20 });
      setNotifications(result.data ?? []);
      if (result.meta) {
        setTotalPages(Math.ceil(result.meta.total / result.meta.limit) || 1);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load notifications"
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = notifications.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.type.toLowerCase().includes(q) ||
      n.channel.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.subject && n.subject.toLowerCase().includes(q)) ||
      (n.eventKey && n.eventKey.toLowerCase().includes(q))
    );
  });

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
            Communication Logs
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            System Notifications
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Monitor all platform notification dispatches, delivery status, and communication logs.
          </p>
        </div>

        {/* Filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by type, channel, subject, or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Notifications List */}
        <section className="space-y-4">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-2">
              <p className="font-serif text-lg font-light text-foreground">
                No Notifications
              </p>
              <p className="text-sm text-muted-foreground">
                No notification records found.
              </p>
            </div>
          ) : (
            filtered.map((notif, index) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.03, duration: 0.4 }}
                className="border border-border-soft bg-card cursor-pointer"
                onClick={() => setExpandedId(expandedId === notif.id ? null : notif.id)}
              >
                {/* Notification Header */}
                <div className="flex items-center justify-between gap-4 p-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {notif.subject || notif.type}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border border-border-soft text-muted-foreground">
                          {notif.channel}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border border-border-soft text-muted-foreground">
                          {notif.type}
                        </span>
                        {notif.isRead && (
                          <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border border-[#7B9971]/30 text-[#5A7352]">
                            Read
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(notif.status)}`}
                    >
                      {notif.status}
                    </span>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {notif.createdAt
                        ? new Date(notif.createdAt).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === notif.id && (
                  <div className="border-t border-border-soft">
                    <div className="grid gap-px bg-border-soft sm:grid-cols-3">
                      <div className="bg-card p-6 space-y-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Recipient
                        </p>
                        <p className="text-sm text-foreground">
                          {notif.userId
                            ? notif.userId.slice(0, 8).toUpperCase()
                            : notif.role ?? "—"}
                        </p>
                      </div>
                      <div className="bg-card p-6 space-y-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Event Key
                        </p>
                        <p className="text-sm text-foreground font-mono">
                          {notif.eventKey ?? "—"}
                        </p>
                      </div>
                      <div className="bg-card p-6 space-y-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Sent At
                        </p>
                        <p className="text-sm text-foreground">
                          {notif.sentAt
                            ? new Date(notif.sentAt).toLocaleString("en-IN")
                            : "Not sent"}
                        </p>
                      </div>
                    </div>
                    <div className="p-6 border-t border-border-soft">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
                        Content
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {notif.content}
                      </p>
                    </div>
                    {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                      <div className="p-6 border-t border-border-soft">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
                          Metadata
                        </p>
                        <pre className="text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(notif.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </section>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm border border-border-soft text-foreground disabled:opacity-40 hover:bg-mist/50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm border border-border-soft text-foreground disabled:opacity-40 hover:bg-mist/50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
