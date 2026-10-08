"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminProduct,
  getPendingProducts,
  updateProductDetails,
} from "@/services/admin";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type VariantReviewState = Record<
  string,
  {
    adminListingPrice: string;
    compareAtPrice: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    rejectionReason: string;
  }
>;

const getStatusStyle = (status?: string | null) => {
  switch (String(status ?? "PENDING").toUpperCase()) {
    case "APPROVED":
      return "border-brand/40 text-brand-strong bg-brand/10";
    case "REJECTED":
      return "border-destructive/30 text-destructive bg-destructive/10";
    default:
      return "border-border-soft text-muted-foreground bg-card";
  }
};

const buildVariantReviewState = (product: AdminProduct): VariantReviewState => {
  const next: VariantReviewState = {};
  for (const variant of product.variants ?? []) {
    next[variant.id] = {
      adminListingPrice:
        variant.adminListingPrice != null ? String(variant.adminListingPrice) : "",
      compareAtPrice:
        variant.compareAtPrice != null ? String(variant.compareAtPrice) : "",
      status: variant.status ?? "PENDING",
      rejectionReason: variant.rejectionReason ?? "",
    };
  }
  return next;
};

export default function AdminModerationPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [products, setProducts] = React.useState<AdminProduct[]>([]);
  const [selectedProduct, setSelectedProduct] =
    React.useState<AdminProduct | null>(null);
  const [variantState, setVariantState] = React.useState<VariantReviewState>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const pendingResult = await getPendingProducts();
      setProducts(pendingResult.products ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to load pending approval requests"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openReviewModal = (product: AdminProduct) => {
    setSelectedProduct(product);
    setVariantState(buildVariantReviewState(product));
  };

  const closeReviewModal = () => {
    setSelectedProduct(null);
    setVariantState({});
  };

  const updateVariant = (
    variantId: string,
    patch: Partial<VariantReviewState[string]>
  ) => {
    setVariantState((prev) => ({
      ...prev,
      [variantId]: {
        adminListingPrice: prev[variantId]?.adminListingPrice ?? "",
        compareAtPrice: prev[variantId]?.compareAtPrice ?? "",
        status: prev[variantId]?.status ?? "PENDING",
        rejectionReason: prev[variantId]?.rejectionReason ?? "",
        ...patch,
      },
    }));
  };

  const applyBulkStatus = (status: "APPROVED" | "REJECTED") => {
    if (!selectedProduct) return;
    setVariantState((prev) => {
      const next = { ...prev };
      for (const variant of selectedProduct.variants ?? []) {
        if (variant.status !== "PENDING") continue;
        next[variant.id] = {
          adminListingPrice:
            prev[variant.id]?.adminListingPrice ??
            (variant.adminListingPrice != null ? String(variant.adminListingPrice) : ""),
          compareAtPrice:
            prev[variant.id]?.compareAtPrice ??
            (variant.compareAtPrice != null ? String(variant.compareAtPrice) : ""),
          status,
          rejectionReason:
            status === "REJECTED"
              ? prev[variant.id]?.rejectionReason ?? "Rejected during moderation"
              : "",
        };
      }
      return next;
    });
  };

  const submitReview = async () => {
    if (!selectedProduct) return;

    try {
      const variants = (selectedProduct.variants ?? []).map((variant) => {
        const current = variantState[variant.id] ?? {
          adminListingPrice:
            variant.adminListingPrice != null ? String(variant.adminListingPrice) : "",
          compareAtPrice:
            variant.compareAtPrice != null ? String(variant.compareAtPrice) : "",
          status: variant.status ?? "PENDING",
          rejectionReason: variant.rejectionReason ?? "",
        };

        const adminListingPrice = current.adminListingPrice.trim()
          ? Number(current.adminListingPrice)
          : null;
        const compareAtPrice = current.compareAtPrice.trim()
          ? Number(current.compareAtPrice)
          : null;

        if (
          adminListingPrice != null &&
          (!Number.isFinite(adminListingPrice) ||
            adminListingPrice < Number(variant.sellerPrice ?? 0))
        ) {
          throw new Error(
            `${variant.sku}: admin price cannot be lower than seller price.`
          );
        }

        const effectivePrice =
          adminListingPrice ?? Number(variant.sellerPrice ?? 0);
        if (
          compareAtPrice != null &&
          (!Number.isFinite(compareAtPrice) || compareAtPrice <= effectivePrice)
        ) {
          throw new Error(
            `${variant.sku}: compare-at price must be greater than the selling price.`
          );
        }

        if (current.status === "REJECTED" && !current.rejectionReason.trim()) {
          throw new Error(`${variant.sku}: provide a rejection reason.`);
        }

        return {
          id: variant.id,
          adminListingPrice,
          compareAtPrice,
          status: current.status,
          rejectionReason:
            current.status === "REJECTED"
              ? current.rejectionReason.trim()
              : null,
        };
      });

      setSaving(true);
      await updateProductDetails(selectedProduct.id, { variants });
      toast.success("Variant review saved.");
      closeReviewModal();
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save variant review"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background dark:bg-card">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Variant Moderation
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Approval Requests
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Review seller pricing per variant, optionally set public admin prices,
            and approve or reject each size and color combination independently.
          </p>
        </div>

        <section className="space-y-6">
          {loading ? (
            <div className="border border-border-soft bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="border border-border-soft bg-card p-12 text-center space-y-2">
              <p className="font-serif text-lg font-light text-foreground">
                No Pending Requests
              </p>
              <p className="text-sm text-muted-foreground">
                No products are currently awaiting approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border-soft bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft">
                    <th className="p-5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Product
                    </th>
                    <th className="p-5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Seller
                    </th>
                    <th className="p-5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Variants
                    </th>
                    <th className="p-5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Pending
                    </th>
                    <th className="p-5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Lowest Seller Price
                    </th>
                    <th className="p-5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {products.map((product, index) => {
                    const variants = product.variants ?? [];
                    const pendingCount = variants.filter(
                      (variant) => variant.status === "PENDING"
                    ).length;
                    const lowestSellerPrice =
                      variants.length > 0
                        ? Math.min(
                            ...variants.map((variant) =>
                              Number(variant.sellerPrice ?? 0)
                            )
                          )
                        : 0;

                    return (
                      <motion.tr
                        key={product.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.08 + index * 0.03, duration: 0.3 }}
                        className="hover:bg-mist/30 dark:hover:bg-navy/10"
                      >
                        <td className="p-5">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {product.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {product.categoryName ?? "Uncategorized"}
                            </p>
                          </div>
                        </td>
                        <td className="p-5 text-muted-foreground">
                          {product.sellerName ??
                            product.sellerEmail ??
                            product.sellerId.slice(0, 8)}
                        </td>
                        <td className="p-5 text-muted-foreground">
                          {variants.length}
                        </td>
                        <td className="p-5">
                          <span
                            className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(
                              pendingCount > 0 ? "PENDING" : product.status
                            )}`}
                          >
                            {pendingCount} pending
                          </span>
                        </td>
                        <td className="p-5 text-muted-foreground">
                          {currency.format(lowestSellerPrice)}
                        </td>
                        <td className="p-5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="whitespace-nowrap px-3 text-[10px]"
                            onClick={() => openReviewModal(product)}
                          >
                            Review Variants
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <AnimatePresence>
          {selectedProduct ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
              onClick={closeReviewModal}
            >
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-border-soft bg-card p-6 space-y-6"
              >
                <div className="flex items-start justify-between gap-4 border-b border-border-soft pb-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                      Variant Pricing Review
                    </p>
                    <h2 className="text-xl font-semibold text-foreground">
                      {selectedProduct.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Seller:{" "}
                      {selectedProduct.sellerName ??
                        selectedProduct.sellerEmail ??
                        selectedProduct.sellerId}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyBulkStatus("APPROVED")}
                    >
                      Approve Pending
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyBulkStatus("REJECTED")}
                    >
                      Reject Pending
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {(selectedProduct.variants ?? []).map((variant) => {
                    const current = variantState[variant.id];
                    const adminListingPrice = current?.adminListingPrice ?? "";
                    const compareAtPrice = current?.compareAtPrice ?? "";
                    const effectivePrice = adminListingPrice.trim()
                      ? Number(adminListingPrice)
                      : Number(variant.sellerPrice ?? 0);

                    return (
                      <div
                        key={variant.id}
                        className="space-y-4 border border-border-soft p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {variant.size} {variant.color ? `· ${variant.color}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {variant.sku}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Seller price: {currency.format(Number(variant.sellerPrice ?? 0))}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getStatusStyle(
                              current?.status ?? variant.status
                            )}`}
                          >
                            {current?.status ?? variant.status}
                          </span>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <label className="space-y-1">
                            <span className="text-xs text-muted-foreground">
                              Admin Price
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={adminListingPrice}
                              placeholder="Optional"
                              onChange={(event) =>
                                updateVariant(variant.id, {
                                  adminListingPrice: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-muted-foreground">
                              Compare At
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={compareAtPrice}
                              placeholder="Optional"
                              onChange={(event) =>
                                updateVariant(variant.id, {
                                  compareAtPrice: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-muted-foreground">
                              Status
                            </span>
                            <select
                              className="h-10 w-full border border-border-soft bg-card px-3 text-sm text-foreground"
                              value={current?.status ?? variant.status}
                              onChange={(event) =>
                                updateVariant(variant.id, {
                                  status: event.target.value as
                                    | "PENDING"
                                    | "APPROVED"
                                    | "REJECTED",
                                })
                              }
                            >
                              <option value="PENDING">Pending</option>
                              <option value="APPROVED">Approved</option>
                              <option value="REJECTED">Rejected</option>
                            </select>
                          </label>
                          <div className="space-y-1 rounded border border-border-soft px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                              Effective Sell Price
                            </p>
                            <p className="font-medium text-foreground">
                              {currency.format(effectivePrice)}
                            </p>
                          </div>
                        </div>

                        <label className="space-y-1">
                          <span className="text-xs text-muted-foreground">
                            Rejection Reason
                          </span>
                          <Input
                            value={current?.rejectionReason ?? ""}
                            placeholder="Required if rejected"
                            onChange={(event) =>
                              updateVariant(variant.id, {
                                rejectionReason: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button size="sm" onClick={submitReview} disabled={saving}>
                    {saving ? "Saving…" : "Save Review"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={closeReviewModal}
                    disabled={saving}
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
