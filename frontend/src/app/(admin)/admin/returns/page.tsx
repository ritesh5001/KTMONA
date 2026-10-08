"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  approveReturn,
  listAdminReturns,
  processReturnRefund,
  rejectReturn,
  type ReturnRequestRecord,
} from "@/services/returns";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const getStatusStyle = (status: string) => {
  switch (status.toUpperCase()) {
    case "REQUESTED":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    case "APPROVED":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "INSPECTING":
      return "border-[#8B9CB8]/30 text-[#5E6B82] bg-[#8B9CB8]/5";
    case "REJECTED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    case "REFUNDED":
      return "border-[#7B9971]/40 text-[#5A7352] bg-[#7B9971]/10";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

type FilterStatus = "REQUESTED" | "APPROVED" | "ALL";

export default function AdminReturnsPage() {
  const [loading, setLoading] = React.useState(true);
  const [returns, setReturns] = React.useState<ReturnRequestRecord[]>([]);
  const [mutatingId, setMutatingId] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("REQUESTED");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus === "ALL" ? undefined : { status: filterStatus as any };
      const result = await listAdminReturns(params);
      setReturns(result.returns ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load returns");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleApprove = React.useCallback(
    async (id: string) => {
      if (!window.confirm("Approve this return request? This will restock inventory.")) return;
      const previous = returns;
      setMutatingId(id);
      setReturns((prev) => prev.map((r) => (r.id === id ? { ...r, status: "APPROVED" as const } : r)));
      try {
        await approveReturn(id);
        toast.success("Return approved — inventory restocked");
        load();
      } catch (error) {
        setReturns(previous);
        toast.error(error instanceof Error ? error.message : "Approval failed");
      } finally {
        setMutatingId(null);
      }
    },
    [returns, load],
  );

  const handleReject = React.useCallback(
    async (id: string) => {
      if (!window.confirm("Reject this return request?")) return;
      const previous = returns;
      setMutatingId(id);
      setReturns((prev) => prev.filter((item) => item.id !== id));
      try {
        await rejectReturn(id);
        toast.success("Return rejected");
      } catch (error) {
        setReturns(previous);
        toast.error(error instanceof Error ? error.message : "Rejection failed");
      } finally {
        setMutatingId(null);
      }
    },
    [returns],
  );

  const handleRefund = React.useCallback(
    async (id: string) => {
      if (!window.confirm("Process refund for this return? This action cannot be undone.")) return;
      const previous = returns;
      setMutatingId(id);
      setReturns((prev) => prev.map((r) => (r.id === id ? { ...r, status: "REFUNDED" as const } : r)));
      try {
        await processReturnRefund(id);
        toast.success("Refund processed successfully");
        load();
      } catch (error) {
        setReturns(previous);
        toast.error(error instanceof Error ? error.message : "Refund failed");
      } finally {
        setMutatingId(null);
      }
    },
    [returns, load],
  );

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16"
      >
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Return Governance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Return Requests
          </h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(["REQUESTED", "APPROVED", "ALL"] as FilterStatus[]).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={filterStatus === status ? "primary" : "outline"}
              onClick={() => setFilterStatus(status)}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="border border-border-soft bg-card p-12 text-center text-sm text-muted-foreground">
            Loading return requests...
          </div>
        ) : returns.length === 0 ? (
          <div className="border border-border-soft bg-card p-12 text-center text-sm text-muted-foreground">
            No return requests found.
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((item) => (
              <div key={item.id} className="border border-border-soft bg-card p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Return ID</p>
                    <p className="font-medium text-foreground">{item.id.slice(0, 12)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Order ID</p>
                    <p className="font-medium text-foreground">{item.orderId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">User</p>
                    <p className="font-medium text-foreground">
                      {item.user?.user_profiles?.full_name ?? item.user?.email ?? item.userId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                    <span
                      className={`inline-block px-2 py-1 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(
                        item.status,
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Refund Amount</p>
                    <p className="font-medium text-foreground">{currency.format(item.refundAmount ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Items</p>
                    <p className="font-medium text-foreground">
                      {item.items?.length ?? 0} item(s)
                    </p>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Reason</p>
                    <p className="font-medium text-foreground">{item.reason}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {item.status === "REQUESTED" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        disabled={mutatingId === item.id}
                      >
                        {mutatingId === item.id ? "Processing..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(item.id)}
                        disabled={mutatingId === item.id}
                      >
                        {mutatingId === item.id ? "Processing..." : "Reject"}
                      </Button>
                    </>
                  )}
                  {(item.status === "APPROVED" || item.status === "INSPECTING") && (
                    <Button
                      size="sm"
                      onClick={() => handleRefund(item.id)}
                      disabled={mutatingId === item.id}
                    >
                      {mutatingId === item.id ? "Processing..." : "Process Refund"}
                    </Button>
                  )}
                  {item.status === "REFUNDED" && (
                    <span className="text-xs text-[#5A7352]">Refund completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
