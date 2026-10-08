"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { AdminPayment, getPayments } from "@/services/admin";
import { toast } from "sonner";

const getStatusStyle = (status: string) => {
  switch (status.toUpperCase()) {
    case "SUCCESS":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "PENDING":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    case "FAILED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    case "REFUNDED":
      return "border-[#6B8DAD]/30 text-[#4A6B7F] bg-[#6B8DAD]/5";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

export default function AdminPaymentsPage() {
  const [loading, setLoading] = React.useState(true);
  const [payments, setPayments] = React.useState<AdminPayment[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await getPayments();
        setPayments(result.payments ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load payments"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = payments.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      (p.orderId && p.orderId.toLowerCase().includes(search.toLowerCase())) ||
      String(p.amount).includes(search);
    const matchesStatus =
      !statusFilter || p.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSuccess = payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + Number(p.amount), 0);

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
            Financial Operations
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Payment Ledger
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Track all platform payment transactions with full transparency.
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
              Total Transactions
            </p>
            <p className="text-xl font-semibold text-foreground">
              {payments.length}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="bg-card p-6 space-y-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
              Successful Revenue
            </p>
            <p className="text-xl font-semibold text-foreground">
              ₹{totalSuccess.toLocaleString("en-IN")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-card p-6 space-y-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
              Success Rate
            </p>
            <p className="text-xl font-semibold text-foreground">
              {payments.length > 0
                ? (
                    (payments.filter((p) => p.status === "SUCCESS").length /
                      payments.length) *
                    100
                  ).toFixed(1)
                : "0"}
              %
            </p>
          </motion.div>
        </section>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by ID, order ID, or amount..."
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
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>

        {/* Payments Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="border border-border-soft bg-card"
        >
          <div className="border-b border-border-soft p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Transactions
            </p>
            <p className="font-serif text-lg font-light text-foreground">
              Payment Records ({filtered.length})
            </p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading payments...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No payments found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft">
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Payment ID
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Order
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Amount
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Provider
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Status
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {filtered.map((payment, index) => (
                    <motion.tr
                      key={payment.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 + index * 0.03, duration: 0.3 }}
                      className="hover:bg-mist/30 dark:hover:bg-navy/10 transition-colors duration-200"
                    >
                      <td className="p-6 font-mono text-xs font-medium text-foreground">
                        {payment.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="p-6 font-mono text-xs text-muted-foreground">
                        {payment.orderId
                          ? payment.orderId.slice(0, 8).toUpperCase()
                          : "—"}
                      </td>
                      <td className="p-6 font-medium text-foreground">
                        ₹{Number(payment.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {payment.provider}
                      </td>
                      <td className="p-6">
                        <span
                          className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(payment.status)}`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {payment.createdAt
                          ? new Date(payment.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : "—"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
