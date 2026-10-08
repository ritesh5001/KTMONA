"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { listMyReturns, type ReturnRequestRecord } from "@/services/returns";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const getReturnStatusStyle = (status: string) => {
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

export default function UserReturnsPage() {
  const [returns, setReturns] = React.useState<ReturnRequestRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMyReturns();
      setReturns(result.returns ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load returns");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-[50vh]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex w-full flex-col gap-8"
      >
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Return History
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Your Returns
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Track the status of your return requests and refunds.
          </p>
        </div>

        <section className="space-y-6">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading your returns...</p>
            </div>
          ) : returns.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                You have no return requests yet.
              </p>
            </div>
          ) : (
            returns.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05, duration: 0.5 }}
                className="border border-border-soft bg-card"
              >
                <div className="flex flex-col gap-4 p-6 border-b border-border-soft sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-serif text-lg font-normal text-foreground">
                      Return {item.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Order: {item.orderId}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getReturnStatusStyle(
                      item.status,
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="grid gap-px bg-border-soft sm:grid-cols-4">
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Requested On
                    </p>
                    <p className="font-medium text-foreground">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Items
                    </p>
                    <p className="font-medium text-foreground">
                      {item.items?.length ?? 0} {(item.items?.length ?? 0) === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Refund Amount
                    </p>
                    <p className="font-serif text-lg font-light text-foreground">
                      {currency.format(item.refundAmount ?? 0)}
                    </p>
                  </div>
                  <div className="bg-card p-6 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Reason
                    </p>
                    <p className="text-sm text-foreground line-clamp-2">{item.reason}</p>
                  </div>
                </div>

                {item.rejectionReason ? (
                  <div className="p-6 border-t border-border-soft">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-[#7A5656]">{item.rejectionReason}</p>
                  </div>
                ) : null}
              </motion.div>
            ))
          )}
        </section>
      </motion.div>
    </div>
  );
}
