"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { approveSeller, getSellers, suspendSeller } from "@/services/admin";
import { toast } from "sonner";

const getStatusStyle = (status: string) => {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
    case "PENDING":
      return "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5";
    case "SUSPENDED":
      return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
    default:
      return "border-border-soft text-muted-foreground bg-mist/30";
  }
};

export default function AdminSellersPage() {
  const [loading, setLoading] = React.useState(true);
  const [sellers, setSellers] = React.useState<Array<any>>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSellers();
      setSellers(result.sellers ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load sellers"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    try {
      await approveSeller(id);
      toast.success("Seller approved.");
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to approve seller"
      );
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      await suspendSeller(id);
      toast.success("Seller suspended.");
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to suspend seller"
      );
    }
  };

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
            Vendor Management
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Seller Approvals
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Review and moderate seller accounts with deliberate authority.
          </p>
        </div>

        {/* Sellers Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="border border-border-soft bg-card"
        >
          <div className="border-b border-border-soft p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Registry
            </p>
            <p className="font-serif text-lg font-light text-foreground">
              Verified Sellers
            </p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading sellers...</p>
              </div>
            ) : sellers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No sellers found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft">
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Seller
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Status
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Joined
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {sellers.map((seller, index) => (
                    <motion.tr
                      key={seller.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 + index * 0.03, duration: 0.3 }}
                      className="hover:bg-mist/30 dark:hover:bg-navy/10 transition-colors duration-200"
                    >
                      <td className="p-6 font-medium text-foreground">
                        {seller.email ?? seller.phone ?? seller.id?.slice(0, 8)}
                      </td>
                      <td className="p-6">
                        <span className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(seller.status)}`}>
                          {seller.status}
                        </span>
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {seller.createdAt
                          ? new Date(seller.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                          : "—"}
                      </td>
                      <td className="p-6">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(seller.id)}
                            disabled={seller.status === "ACTIVE"}
                            className="h-9"
                          >
                            {seller.status === "ACTIVE" ? "Approved" : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSuspend(seller.id)}
                            disabled={seller.status === "SUSPENDED"}
                            className="h-9 text-muted-foreground hover:text-[#7A5656] hover:border-[#A67575]/40"
                          >
                            {seller.status === "SUSPENDED" ? "Suspended" : "Suspend"}
                          </Button>
                        </div>
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
