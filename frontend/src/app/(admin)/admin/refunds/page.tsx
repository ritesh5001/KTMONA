"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { AdminRefund, getRefunds } from "@/services/admin";
import { toast } from "sonner";

const getStatusStyle = (status: string) => {
  switch (status.toUpperCase()) {
    case "SUCCESS":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "PENDING":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    case "FAILED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

const getInitiatorStyle = (initiatedBy: string) => {
  switch (initiatedBy.toUpperCase()) {
    case "ADMIN":
      return "border-[#6B8DAD]/30 text-[#4A6B7F] bg-[#6B8DAD]/5";
    case "SYSTEM":
      return "border-border-soft text-muted-foreground bg-mist/30";
    case "BUYER":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

export default function AdminRefundsPage() {
  const [loading, setLoading] = React.useState(true);
  const [refunds, setRefunds] = React.useState<AdminRefund[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await getRefunds(
          statusFilter ? { status: statusFilter } : undefined
        );
        setRefunds(result.refunds ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load refunds"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [statusFilter]);

  const filtered = refunds.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.orderId.toLowerCase().includes(q) ||
      r.paymentId.toLowerCase().includes(q) ||
      String(r.amount).includes(q) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  const totalRefunded = refunds
    .filter((r) => r.status === "SUCCESS")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPending = refunds
    .filter((r) => r.status === "PENDING")
    .reduce((sum, r) => sum + Number(r.amount), 0);

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
            Financial Compliance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Refund Ledger
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Track all platform refund transactions, their status, and initiating authority.
          </p>
        </div>

        {/* Summary Cards */}
        <section className="grid gap-px bg-border-soft sm:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="bg-card p-6 space-y-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
              Total Refunds
            </p>
            <p className="text-xl font-semibold text-foreground">
              {refunds.length}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="bg-card p-6 space-y-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
              Amount Refunded
            </p>
            <p className="text-xl font-semibold text-foreground">
              ₹{totalRefunded.toLocaleString("en-IN")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-card p-6 space-y-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
              Pending Refunds
            </p>
            <p className="text-xl font-semibold text-foreground">
              ₹{totalPending.toLocaleString("en-IN")}
            </p>
          </motion.div>
        </section>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by ID, order, payment, or reason..."
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
            <option value="PENDING">Pending</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        {/* Refunds List */}
        <section className="space-y-4">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading refunds...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-2">
              <p className="font-serif text-lg font-light text-foreground">
                No Refunds
              </p>
              <p className="text-sm text-muted-foreground">
                No refund records match your criteria.
              </p>
            </div>
          ) : (
            filtered.map((refund, index) => (
              <motion.div
                key={refund.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.03, duration: 0.4 }}
                className="border border-border-soft bg-card"
              >
                {/* Refund Header */}
                <div className="flex items-center justify-between gap-4 p-6 border-b border-border-soft">
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-xs font-medium text-foreground">
                      {refund.id.slice(0, 8).toUpperCase()}
                    </p>
                    <span
                      className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wider border ${getInitiatorStyle(refund.initiatedBy)}`}
                    >
                      {refund.initiatedBy}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(refund.status)}`}
                  >
                    {refund.status}
                  </span>
                </div>

                {/* Refund Details */}
                <div className="grid gap-px bg-border-soft sm:grid-cols-4">
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Amount
                    </p>
                    <p className="font-medium text-foreground">
                      ₹{Number(refund.amount).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Order
                    </p>
                    <p className="font-mono text-sm text-foreground">
                      {refund.orderId.slice(0, 8).toUpperCase()}
                    </p>
                    {refund.order && (
                      <p className="text-xs text-muted-foreground">
                        ₹{Number(refund.order.totalAmount).toLocaleString("en-IN")} · {refund.order.status}
                      </p>
                    )}
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Payment
                    </p>
                    <p className="font-mono text-sm text-foreground">
                      {refund.paymentId.slice(0, 8).toUpperCase()}
                    </p>
                    {refund.payment && (
                      <p className="text-xs text-muted-foreground">
                        {refund.payment.provider}
                      </p>
                    )}
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Reason
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {refund.reason || "—"}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 text-xs text-muted-foreground border-t border-border-soft">
                  <span>
                    Created: {refund.createdAt
                      ? new Date(refund.createdAt).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                  {refund.razorpayRefundId && (
                    <span className="font-mono">
                      Ref: {refund.razorpayRefundId}
                    </span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </section>
      </motion.div>
    </div>
  );
}
