"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteAdminReview,
  getAdminReviews,
  hideAdminReview,
  type AdminReview,
} from "@/services/admin";
import { toast } from "sonner";

export default function AdminReviewsPage() {
  const [loading, setLoading] = React.useState(true);
  const [reviews, setReviews] = React.useState<AdminReview[]>([]);
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminReviews();
      setReviews(result.reviews ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load reviews"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    try {
      await deleteAdminReview(id);
      toast.success("Review deleted.");
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete review"
      );
    }
  };

  const handleToggleHide = async (id: string, currentlyHidden: boolean) => {
    try {
      await hideAdminReview(id, !currentlyHidden);
      toast.success(currentlyHidden ? "Review visible again." : "Review hidden.");
      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isHidden: !currentlyHidden } : r))
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update review"
      );
    }
  };

  const filteredReviews = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reviews;

    return reviews.filter((review) => {
      const haystack = [
        review.product?.title,
        review.user?.email,
        review.user?.fullName,
        review.title,
        review.text,
        review.rating?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [reviews, query]);

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
            Customer Feedback
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Reviews
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Monitor product reviews, spot trends, and manage visibility.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="border border-border-soft bg-card p-4 flex items-center gap-3"
        >
          <Input
            placeholder="Search by product, user, rating, title, or review text..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="border-0 bg-transparent focus-visible:ring-0 h-10"
          />
        </motion.div>

        <section className="space-y-6">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading reviews...</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-2">
              <p className="font-serif text-lg font-light text-foreground">
                No reviews found
              </p>
              <p className="text-sm text-muted-foreground">
                Try a different search keyword.
              </p>
            </div>
          ) : (
            filteredReviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.04, duration: 0.5 }}
                className={`border bg-card ${review.isHidden ? "border-[#A67575]/30 opacity-60" : "border-border-soft"}`}
              >
                <div className="flex flex-col gap-4 border-b border-border-soft p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-serif text-lg font-normal text-foreground">
                        {review.product?.title ?? "Unknown product"}
                      </p>
                      {review.isHidden && (
                        <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider border border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {review.user?.fullName ?? "Anonymous"} · {review.user?.email ?? "No email"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border border-brand/30 text-[#B84A00] bg-brand/5">
                      {review.rating} ★
                    </span>
                    {typeof review.helpfulCount === "number" && review.helpfulCount > 0 && (
                      <span className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5">
                        {review.helpfulCount} helpful
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {review.title && (
                    <p className="text-sm font-medium text-foreground">{review.title}</p>
                  )}
                  <p className="text-sm leading-relaxed text-foreground">
                    {review.text}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className={
                          review.isHidden
                            ? "border-[#7B9971]/40 text-[#5A7352]"
                            : "border-brand/40 text-[#B84A00]"
                        }
                        onClick={() => handleToggleHide(review.id, !!review.isHidden)}
                      >
                        {review.isHidden ? "Show" : "Hide"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#A67575]/40 text-[#7A5656]"
                        onClick={() => handleDelete(review.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </section>
      </motion.div>
    </div>
  );
}
