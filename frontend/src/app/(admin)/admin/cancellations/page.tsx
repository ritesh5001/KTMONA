"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  approveCancellation,
  listAdminCancellations,
  rejectCancellation,
  type CancellationRequestRecord,
} from "@/services/cancellations";
import { toast } from "sonner";

export default function AdminCancellationsPage() {
  const [loading, setLoading] = React.useState(true);
  const [cancellations, setCancellations] = React.useState<CancellationRequestRecord[]>([]);
  const [mutatingId, setMutatingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminCancellations({ status: "REQUESTED" });
      setCancellations(result.cancellations ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load cancellations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleApprove = React.useCallback(
    async (id: string) => {
      if (!window.confirm("Approve this cancellation request?")) return;
      const previous = cancellations;
      setMutatingId(id);
      setCancellations((prev) => prev.filter((item) => item.id !== id));
      try {
        await approveCancellation(id);
        toast.success("Cancellation approved");
      } catch (error) {
        setCancellations(previous);
        toast.error(error instanceof Error ? error.message : "Approval failed");
      } finally {
        setMutatingId(null);
      }
    },
    [cancellations],
  );

  const handleReject = React.useCallback(
    async (id: string) => {
      if (!window.confirm("Reject this cancellation request?")) return;
      const previous = cancellations;
      setMutatingId(id);
      setCancellations((prev) => prev.filter((item) => item.id !== id));
      try {
        await rejectCancellation(id);
        toast.success("Cancellation rejected");
      } catch (error) {
        setCancellations(previous);
        toast.error(error instanceof Error ? error.message : "Rejection failed");
      } finally {
        setMutatingId(null);
      }
    },
    [cancellations],
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
            Cancellation Governance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Pending Cancellations
          </h1>
        </div>

        {loading ? (
          <div className="border border-border-soft bg-card p-12 text-center text-sm text-muted-foreground">
            Loading cancellation requests...
          </div>
        ) : cancellations.length === 0 ? (
          <div className="border border-border-soft bg-card p-12 text-center text-sm text-muted-foreground">
            No pending cancellation requests.
          </div>
        ) : (
          <div className="space-y-4">
            {cancellations.map((item) => (
              <div key={item.id} className="border border-border-soft bg-card p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Created At</p>
                    <p className="font-medium text-foreground">
                      {new Date(item.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Payment Status</p>
                    <p className="font-medium text-foreground">{item.order?.payment?.status ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Order Status</p>
                    <p className="font-medium text-foreground">{item.order?.status ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Reason</p>
                    <p className="font-medium text-foreground">{item.reason}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
