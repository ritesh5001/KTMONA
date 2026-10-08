"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useHydratedSWR } from "@/hooks/use-hydrated-swr";
import {
  listSellerSettlements,
  type SellerSettlement,
} from "@/services/seller-settlements";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function statusBadge(status: SellerSettlement["status"]) {
  switch (status) {
    case "SETTLED":
      return {
        label: "SETTLED",
        className:
          "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5",
      };
    case "FAILED":
      return {
        label: "FAILED",
        className:
          "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5",
      };
    default:
      return {
        label: "PENDING",
        className:
          "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5",
      };
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-4 border-b border-border-soft px-6 py-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse bg-border-soft dark:bg-border"
        />
      ))}
    </div>
  );
}

const EASE = [0.25, 0.1, 0.25, 1] as const;
const PER_PAGE = 10;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SellerSettlementsPage() {
  // Cached across navigations: this list is paginated and sorted entirely on the
  // client, so re-fetching it on every mount bought nothing but a cold request.
  const {
    data: settlements = [],
    isLoading: loading,
  } = useHydratedSWR<SellerSettlement[]>({
    key: "seller-settlements",
    fetcher: listSellerSettlements,
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to load settlements"
      );
    },
  });
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [page, setPage] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<
    "createdAt" | "grossAmount" | "netAmount"
  >("createdAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  // ── Filtering ─────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return settlements.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        s.id,
        s.orderId,
        s.order?.invoiceNumber,
        s.order?.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [settlements, searchQuery, statusFilter]);

  // ── Sorting ───────────────────────────────────────────────────────────
  const sorted = React.useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: number;
      let bv: number;
      if (sortKey === "createdAt") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paged = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleSort = (key: typeof sortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  // ── Aggregates ────────────────────────────────────────────────────────
  const totals = React.useMemo(() => {
    let gross = 0;
    let fee = 0;
    let net = 0;
    for (const s of settlements) {
      gross += s.grossAmount;
      fee += s.platformFee;
      net += s.netAmount;
    }
    return { gross, fee, net };
  }, [settlements]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
      >
        {/* Header */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Settlements &amp; Payouts
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Financial Overview
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Track your earnings, platform fees, and net payouts
            across all fulfilled orders.
          </p>
        </div>

        {/* KPI Cards */}
        <section className="grid gap-px bg-border-soft sm:grid-cols-2 lg:grid-cols-3 overflow-hidden">
          {[
            { label: "Gross Sales", value: currency.format(totals.gross) },
            { label: "Platform Fee", value: currency.format(totals.fee) },
            { label: "Net Payout", value: currency.format(totals.net) },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.05 + i * 0.03,
                duration: 0.5,
                ease: EASE,
              }}
              className="bg-card p-5 lg:p-6 space-y-3 transition-colors duration-300 hover:bg-mist/60 dark:hover:bg-navy/20"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                {stat.label}
              </p>
              <p className="font-serif text-2xl font-light tracking-tight text-foreground">
                {stat.value}
              </p>
            </motion.div>
          ))}
        </section>

        {/* Filters */}
        <div className="border border-border-soft bg-card p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 md:max-w-md flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search by order ID, invoice number..."
              className="border-0 bg-transparent focus-visible:ring-0 h-10"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Status
            </span>
            <select
              className="h-10 px-4 border border-border-soft bg-card text-sm text-foreground outline-none transition focus:border-brand"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="SETTLED">Settled</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-border-soft bg-card overflow-x-auto">
          {/* Table head */}
          <div className="border-b border-border-soft">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1.5fr_0.8fr_0.8fr] gap-4 px-6 py-3">
              {[
                { key: null, label: "Order" },
                {
                  key: "grossAmount" as const,
                  label: "Gross",
                },
                { key: null, label: "Platform Fee" },
                {
                  key: "netAmount" as const,
                  label: "Net Payout",
                },
                { key: null, label: "Status" },
                {
                  key: "createdAt" as const,
                  label: "Date",
                },
              ].map(({ key, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    key && handleSort(key)
                  }
                  className={`text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground ${
                    key
                      ? "cursor-pointer hover:text-foreground transition-colors"
                      : "cursor-default"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {key && sortKey === key && (
                      <span className="text-brand-strong">
                        {sortDir === "desc" ? "↓" : "↑"}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          {loading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : paged.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {settlements.length === 0
                  ? "No settlement records yet. Settlements are created when orders are confirmed."
                  : "No results match your filters."}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {paged.map((s, i) => {
                const badge = statusBadge(s.status);
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      delay: i * 0.02,
                      duration: 0.3,
                    }}
                    className="grid grid-cols-[1.4fr_1fr_1fr_1.5fr_0.8fr_0.8fr] gap-4 border-b border-border-soft px-6 py-4 hover:bg-mist/40 dark:hover:bg-navy/10 transition-colors text-sm"
                  >
                    {/* Order */}
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {s.order?.invoiceNumber ??
                          s.orderId.slice(0, 12) + "…"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {s.orderId.slice(0, 16)}
                      </p>
                    </div>

                    {/* Gross */}
                    <p className="tabular-nums text-foreground self-center">
                      {currency.format(s.grossAmount)}
                    </p>



                    {/* Platform Fee */}
                    <p className="tabular-nums text-muted-foreground self-center">
                      −{currency.format(s.platformFee)}
                    </p>

                    {/* Net */}
                    <p className="tabular-nums font-medium text-foreground self-center">
                      {currency.format(s.netAmount)}
                    </p>

                    {/* Status */}
                    <div className="self-center">
                      <span
                        className={`inline-flex px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-muted-foreground self-center">
                      {dateFmt.format(new Date(s.createdAt))}
                      {s.settledAt && (
                        <>
                          <br />
                          <span className="text-[10px] text-brand-strong">
                            Settled{" "}
                            {dateFmt.format(new Date(s.settledAt))}
                          </span>
                        </>
                      )}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-soft px-6 py-3">
              <p className="text-[11px] text-muted-foreground">
                Page {page + 1} of {totalPages} · {sorted.length} records
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer note */}
        <section className="border-t border-border-soft pt-6">
          <div className="flex flex-wrap items-center justify-center gap-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 bg-brand" />
              Settlements auto-created on order confirmation
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 bg-brand" />
              Net = Gross − Platform Fee
            </span>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
