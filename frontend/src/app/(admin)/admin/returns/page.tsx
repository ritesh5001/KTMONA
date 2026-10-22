"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  approveReturn,
  listAdminReturns,
  markReturnReplaced,
  processReturnRefund,
  rejectReturn,
  RETURN_REASONS,
  updateReturnPickup,
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
    case "REPLACED":
      return "border-[#7B9971]/40 text-[#5A7352] bg-[#7B9971]/10";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

type FilterStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "ALL";

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
      // The customer sees this reason and can appeal it.
      const reason = window.prompt("Reason for rejecting (shown to the customer):")?.trim();
      if (!reason || reason.length < 3) {
        if (reason !== undefined) toast.error("Please give a reason of at least 3 characters.");
        return;
      }
      const previous = returns;
      setMutatingId(id);
      setReturns((prev) => prev.filter((item) => item.id !== id));
      try {
        await rejectReturn(id, reason);
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

  const runAction = React.useCallback(
    async (id: string, action: () => Promise<unknown>, success: string) => {
      setMutatingId(id);
      try {
        await action();
        toast.success(success);
        load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      } finally {
        setMutatingId(null);
      }
    },
    [load],
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
          {(["REQUESTED", "APPROVED", "REJECTED", "ALL"] as FilterStatus[]).map((status) => (
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
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Type</p>
                    <p className="font-medium text-foreground">{item.type === "REPLACEMENT" ? "Replacement" : "Return / refund"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Reason</p>
                    <p className="font-medium text-foreground">
                      {RETURN_REASONS.find((r) => r.code === item.reasonCode)?.label ?? "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                  </div>
                  {item.images?.length ? (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Customer photos</p>
                      <div className="flex flex-wrap gap-2">
                        {item.images.map((src) => (
                          <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                            <img src={src} alt="Return evidence" className="h-20 w-20 rounded-lg object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {item.pickupStatus ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Pickup</p>
                      <p className="font-medium text-foreground">
                        {item.pickupStatus.replace("_", " ").toLowerCase()}
                        {item.pickupTracking ? ` · ${item.pickupCarrier ?? ""} ${item.pickupTracking}` : ""}
                      </p>
                    </div>
                  ) : null}
                  {item.status === "REJECTED" ? (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Rejected because</p>
                      <p className="text-sm">{item.rejectionReason ?? "—"}</p>
                      {item.appealedAt ? (
                        <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                          <strong>Customer appealed:</strong> {item.appealNote}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
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
                    <>
                      <select
                        aria-label="Pickup status"
                        className="h-9 rounded-md border border-border-soft bg-background px-2 text-xs"
                        value={item.pickupStatus ?? ""}
                        disabled={mutatingId === item.id}
                        onChange={(e) => {
                          const status = e.target.value as "SCHEDULED" | "PICKED_UP" | "RECEIVED";
                          if (!status) return;
                          const tracking = status === "SCHEDULED" ? window.prompt("Pickup courier and AWB (optional), e.g. Delhivery 1234567890:") ?? "" : "";
                          const [carrier, ...awb] = tracking.trim().split(/\s+/);
                          void runAction(
                            item.id,
                            () => updateReturnPickup(item.id, {
                              status,
                              ...(carrier && awb.length ? { carrier, tracking: awb.join(" ") } : carrier ? { tracking: carrier } : {}),
                            }),
                            "Pickup updated — customer notified",
                          );
                        }}
                      >
                        <option value="">Pickup: not scheduled</option>
                        <option value="SCHEDULED">Pickup scheduled</option>
                        <option value="PICKED_UP">Picked up</option>
                        <option value="RECEIVED">Received by seller</option>
                      </select>
                      {item.type === "REPLACEMENT" ? (
                        <Button
                          size="sm"
                          disabled={mutatingId === item.id}
                          onClick={() => {
                            const tracking = window.prompt("Replacement shipment tracking number (optional):") ?? undefined;
                            void runAction(item.id, () => markReturnReplaced(item.id, tracking), "Marked as replaced — customer notified");
                          }}
                        >
                          Replacement sent
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant={item.type === "REPLACEMENT" ? "outline" : "primary"}
                        onClick={() => handleRefund(item.id)}
                        disabled={mutatingId === item.id}
                      >
                        {mutatingId === item.id ? "Processing..." : item.type === "REPLACEMENT" ? "Refund instead" : "Process Refund"}
                      </Button>
                    </>
                  )}
                  {item.status === "REPLACED" && (
                    <span className="text-xs text-[#5A7352]">Replacement sent{item.replacementTracking ? ` · ${item.replacementTracking}` : ""}</span>
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
