"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ProfitAnalytics, getProfitAnalytics, getPricingOverview, PricingOverviewProduct } from "@/services/admin";
import { toast } from "sonner";

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = React.useState(true);
  const [analytics, setAnalytics] = React.useState<ProfitAnalytics | null>(null);
  const [pricingProducts, setPricingProducts] = React.useState<PricingOverviewProduct[]>([]);
  const [activeTab, setActiveTab] = React.useState<"profit" | "pricing">("profit");

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profitResult, pricingResult] = await Promise.all([
          getProfitAnalytics(),
          getPricingOverview(),
        ]);
        setAnalytics(profitResult);
        setPricingProducts(pricingResult.products ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to load analytics"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const tabs = [
    { key: "profit" as const, label: "Profit Analysis" },
    { key: "pricing" as const, label: "Pricing Overview" },
  ];

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
            Business Intelligence
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Platform Analytics
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Revenue margins, seller performance, and pricing intelligence across the platform.
          </p>
        </div>

        {loading ? (
          <div className="border border-border-soft bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Revenue Summary Cards */}
            {analytics && (
              <section className="grid gap-px bg-border-soft sm:grid-cols-3">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="bg-card p-6 space-y-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                    Platform Revenue
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    ₹{Number(analytics.totalPlatformRevenue).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Total customer-facing revenue
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="bg-card p-6 space-y-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                    Seller Payouts
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    ₹{Number(analytics.totalSellerPayout).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Total disbursed to sellers
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="bg-card p-6 space-y-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                    Margin Earned
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    ₹{Number(analytics.totalMarginEarned).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Platform profit margin
                  </p>
                </motion.div>
              </section>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-0 border-b border-border-soft">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? "border-brand text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Profit Tab */}
            {activeTab === "profit" && analytics && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Profit Per Product */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                  className="border border-border-soft bg-card"
                >
                  <div className="border-b border-border-soft p-6">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                      Product Level
                    </p>
                    <p className="font-serif text-lg font-light text-foreground">
                      Profit Per Product
                    </p>
                  </div>
                  <div className="divide-y divide-border-soft">
                    {analytics.profitPerProduct.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">No product profit data yet.</p>
                      </div>
                    ) : (
                      analytics.profitPerProduct
                        .sort((a, b) => b.margin - a.margin)
                        .slice(0, 20)
                        .map((item, index) => (
                          <motion.div
                            key={item.productId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 + index * 0.03, duration: 0.3 }}
                            className="flex items-center justify-between gap-4 p-6"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate">
                                {item.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.soldUnits} units sold
                              </p>
                            </div>
                            <p className="font-medium text-foreground shrink-0">
                              ₹{Number(item.margin).toLocaleString("en-IN")}
                            </p>
                          </motion.div>
                        ))
                    )}
                  </div>
                </motion.div>

                {/* Profit Per Seller */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="border border-border-soft bg-card"
                >
                  <div className="border-b border-border-soft p-6">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                      Seller Level
                    </p>
                    <p className="font-serif text-lg font-light text-foreground">
                      Profit Per Seller
                    </p>
                  </div>
                  <div className="divide-y divide-border-soft">
                    {analytics.profitPerSeller.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">No seller profit data yet.</p>
                      </div>
                    ) : (
                      analytics.profitPerSeller
                        .sort((a, b) => b.margin - a.margin)
                        .map((item, index) => (
                          <motion.div
                            key={item.sellerId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.35 + index * 0.03, duration: 0.3 }}
                            className="flex items-center justify-between gap-4 p-6"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate">
                                {item.sellerName || item.sellerEmail || item.sellerId.slice(0, 8).toUpperCase()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.soldUnits} units · {item.sellerEmail ?? ""}
                              </p>
                            </div>
                            <p className="font-medium text-foreground shrink-0">
                              ₹{Number(item.margin).toLocaleString("en-IN")}
                            </p>
                          </motion.div>
                        ))
                    )}
                  </div>
                </motion.div>
              </div>
            )}

            {/* Pricing Overview Tab */}
            {activeTab === "pricing" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="border border-border-soft bg-card"
              >
                <div className="border-b border-border-soft p-6">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    Price Intelligence
                  </p>
                  <p className="font-serif text-lg font-light text-foreground">
                    All Product Pricing ({pricingProducts.length})
                  </p>
                </div>

                <div className="overflow-x-auto">
                  {pricingProducts.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-muted-foreground">No pricing data available.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border-soft">
                          <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Product
                          </th>
                          <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Seller
                          </th>
                          <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Seller Price
                          </th>
                          <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Listing Price
                          </th>
                          <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Margin
                          </th>
                          <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-soft">
                        {pricingProducts.map((product, index) => (
                          <motion.tr
                            key={product.productId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 + index * 0.02, duration: 0.3 }}
                            className="hover:bg-mist/30 dark:hover:bg-navy/10 transition-colors duration-200"
                          >
                            <td className="p-6">
                              <p className="font-medium text-foreground truncate max-w-[200px]">
                                {product.title}
                              </p>
                            </td>
                            <td className="p-6 text-muted-foreground text-xs">
                              {product.sellerName || product.sellerEmail || product.sellerId.slice(0, 8)}
                            </td>
                            <td className="p-6 font-medium text-foreground">
                              ₹{Number(product.sellerPrice).toLocaleString("en-IN")}
                            </td>
                            <td className="p-6 font-medium text-foreground">
                              {product.adminListingPrice
                                ? `₹${Number(product.adminListingPrice).toLocaleString("en-IN")}`
                                : "—"}
                            </td>
                            <td className="p-6">
                              {product.marginPercentage != null ? (
                                <span
                                  className={`font-medium ${
                                    product.marginPercentage > 0
                                      ? "text-[#5A7352]"
                                      : product.marginPercentage < 0
                                      ? "text-[#7A5656]"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {product.marginPercentage.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-6">
                              <span
                                className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${
                                  product.status === "APPROVED"
                                    ? "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5"
                                    : product.status === "PENDING"
                                    ? "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5"
                                    : "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5"
                                }`}
                              >
                                {product.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
