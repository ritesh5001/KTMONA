"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  listAdminReels,
  approveReel,
  rejectReel,
  deleteReelAdmin,
  type Reel,
} from "@/services/reels";

const getStatusBadge = (status: string) => {
  const s = status.toUpperCase();
  if (s === "APPROVED")
    return { label: "APPROVED", className: "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5" };
  if (s === "REJECTED")
    return { label: "REJECTED", className: "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5" };
  return { label: "PENDING", className: "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5" };
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function AdminReelsPage() {
  const [reels, setReels] = React.useState<Reel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);
  const [previewReel, setPreviewReel] = React.useState<Reel | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? { status: statusFilter } : undefined;
      const result = await listAdminReels(params);
      setReels(result.reels ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load reels");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    setActionInProgress(id);
    try {
      await approveReel(id);
      toast.success("Reel approved");
      setReels((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "APPROVED" as const } : r))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionInProgress(id);
    try {
      await rejectReel(id);
      toast.success("Reel rejected");
      setReels((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "REJECTED" as const } : r))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionInProgress(id);
    try {
      await deleteReelAdmin(id);
      toast.success("Reel deleted");
      setReels((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setActionInProgress(null);
    }
  };

  const filtered = reels.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.caption?.toLowerCase().includes(q) ||
      r.seller?.seller_profiles?.store_name?.toLowerCase().includes(q) ||
      r.product?.title?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reel Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and moderate seller reels
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by caption, seller, or product..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          No reels found
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Seller
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Caption
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((reel) => {
                  const badge = getStatusBadge(reel.status);
                  const isActioning = actionInProgress === reel.id;
                  return (
                    <tr
                      key={reel.id}
                      className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
                    >
                      {/* Video Preview */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPreviewReel(reel)}
                          className="block w-16 h-24 rounded-md overflow-hidden bg-muted relative group"
                        >
                          <video
                            src={reel.videoUrl}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <span className="text-white text-xs font-medium">▶</span>
                          </div>
                        </button>
                      </td>

                      {/* Seller */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">
                          {reel.seller?.seller_profiles?.store_name ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reel.seller?.email ?? "—"}
                        </p>
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3">
                        <p className="text-sm truncate max-w-37.5">
                          {reel.product?.title ?? "No product tagged"}
                        </p>
                      </td>

                      {/* Caption */}
                      <td className="px-4 py-3">
                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-50">
                          {reel.caption || "—"}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(reel.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {reel.status !== "APPROVED" && (
                            <button
                              onClick={() => handleApprove(reel.id)}
                              disabled={isActioning}
                              className="p-1.5 rounded-md hover:bg-[#7B9971]/10 text-[#5A7352] transition-colors"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {reel.status !== "REJECTED" && (
                            <button
                              onClick={() => handleReject(reel.id)}
                              disabled={isActioning}
                              className="p-1.5 rounded-md hover:bg-[#A67575]/10 text-[#7A5656] transition-colors"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(reel.id)}
                            disabled={isActioning}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      <AnimatePresence>
        {previewReel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewReel(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-xl shadow-lg p-4 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Reel Preview</h3>
                <button
                  onClick={() => setPreviewReel(null)}
                  className="p-1 rounded-md hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <video
                src={previewReel.videoUrl}
                className="w-full rounded-lg aspect-9/16 max-h-dvh object-cover bg-black"
                controls
                autoPlay
              />
              {previewReel.caption && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {previewReel.caption}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
