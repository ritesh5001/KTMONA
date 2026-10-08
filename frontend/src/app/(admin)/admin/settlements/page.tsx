"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { AdminSettlement, getSettlements } from "@/services/admin";
import { toast } from "sonner";

const getStatusStyle = (status: string) => {
  switch (status.toUpperCase()) {
    case "SETTLED":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "PENDING":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    case "FAILED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

export default function AdminSettlementsPage() {
  const [loading, setLoading] = React.useState(true);
  const [settlements, setSettlements] = React.useState<AdminSettlement[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await getSettlements();
        setSettlements(result.settlements ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load settlements"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = settlements.filter((s) => {
    const matchesSearch =
      !search.trim() ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.orderId.toLowerCase().includes(search.toLowerCase()) ||
      s.sellerId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      !statusFilter || s.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSettled = settlements
    .filter((s) => s.status === "SETTLED")
    .reduce((sum, s) => sum + Number(s.netAmount), 0);
  const totalPending = settlements
    .filter((s) => s.status === "PENDING")
    .reduce((sum, s) => sum + Number(s.netAmount), 0);
  const totalCommission = settlements.reduce(
    (sum, s) => sum + Number(s.commissionAmount),
    0
  );

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
            Seller Disbursements
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Settlement Tracking
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Monitor seller payouts, commission deductions, and settlement status across the platform.
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
              Total Settled
            </p>
            <p className="text-xl font-semibold text-foreground">
              ₹{totalSettled.toLocaleString("en-IN")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="bg-card p-6 space-y-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
              Pending Settlement
            </p>
            <p className="text-xl font-semibold text-foreground">
              ₹{totalPending.toLocaleString("en-IN")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-card p-6 space-y-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
              Commission Earned
            </p>
            <p className="text-xl font-semibold text-foreground">
              ₹{totalCommission.toLocaleString("en-IN")}
            </p>
          </motion.div>
        </section>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by settlement, order, or seller ID..."
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
            <option value="SETTLED">Settled</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        {/* Settlements List */}
        <section className="space-y-4">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading settlements...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-2">
              <p className="font-serif text-lg font-light text-foreground">
                No Settlements
              </p>
              <p className="text-sm text-muted-foreground">
                No settlement records match your criteria.
              </p>
            </div>
          ) : (
            filtered.map((settlement, index) => (
              <motion.div
                key={settlement.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.03, duration: 0.4 }}
                className="border border-border-soft bg-card"
              >
                {/* Settlement Header */}
                <div className="flex items-center justify-between gap-4 p-6 border-b border-border-soft">
                  <div className="space-y-1">
                    <p className="font-mono text-xs font-medium text-foreground">
                      {settlement.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Order: {settlement.orderId.slice(0, 8).toUpperCase()} · Seller: {settlement.sellerId.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(settlement.status)}`}
                  >
                    {settlement.status}
                  </span>
                </div>

                {/* Settlement Details */}
                <div className="grid gap-px bg-border-soft sm:grid-cols-4">
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Gross Amount
                    </p>
                    <p className="font-medium text-foreground">
                      ₹{Number(settlement.grossAmount).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Commission
                    </p>
                    <p className="font-medium text-foreground">
                      ₹{Number(settlement.commissionAmount).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Platform Fee
                    </p>
                    <p className="font-medium text-foreground">
                      ₹{Number(settlement.platformFee).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Net Payout
                    </p>
                    <p className="font-medium text-foreground">
                      ₹{Number(settlement.netAmount).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Settlement Footer */}
                <div className="flex items-center justify-between p-6 text-xs text-muted-foreground border-t border-border-soft">
                  <span>
                    Created: {settlement.createdAt
                      ? new Date(settlement.createdAt).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                  {settlement.settledAt && (
                    <span>
                      Settled: {new Date(settlement.settledAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {settlement.order && (
                    <span>
                      Invoice: {settlement.order.invoiceNumber ?? "—"}
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
