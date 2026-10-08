"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateCoupon, type CouponPreview } from "@/services/cart";

type CouponStatus = "idle" | "applying" | "applied" | "error";

interface CouponSectionProps {
  cartTotal: number;
  appliedCoupon: CouponPreview | null;
  onApply: (coupon: CouponPreview) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export default function CouponSection({
  cartTotal,
  appliedCoupon,
  onApply,
  onRemove,
  disabled = false,
}: CouponSectionProps) {
  const [couponCode, setCouponCode] = React.useState("");
  const [status, setStatus] = React.useState<CouponStatus>(
    appliedCoupon ? "applied" : "idle"
  );
  const [message, setMessage] = React.useState<string | null>(null);

  // Sync status when appliedCoupon is cleared externally (e.g. cart change)
  React.useEffect(() => {
    if (!appliedCoupon && status === "applied") {
      setStatus("idle");
      setMessage(null);
      setCouponCode("");
    }
  }, [appliedCoupon, status]);

  const handleApply = async () => {
    const trimmed = couponCode.trim();
    if (!trimmed) return;

    setStatus("applying");
    setMessage(null);

    try {
      const result = await validateCoupon(trimmed);

      if (result.valid && result.coupon) {
        // Check minimum order on client for UX hint (backend is source of truth at checkout)
        if (
          result.coupon.minOrderAmount !== null &&
          cartTotal < result.coupon.minOrderAmount
        ) {
          setStatus("error");
          setMessage(
            `Minimum order of ₹${result.coupon.minOrderAmount} required`
          );
          return;
        }

        setStatus("applied");
        setMessage(null);
        onApply(result.coupon);
      } else {
        setStatus("error");
        setMessage(result.message ?? "Invalid coupon code");
      }
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Could not validate coupon"
      );
    }
  };

  const handleRemove = () => {
    setCouponCode("");
    setStatus("idle");
    setMessage(null);
    onRemove();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && status !== "applying" && !disabled) {
      e.preventDefault();
      handleApply();
    }
  };

  const formatCouponLabel = (coupon: CouponPreview) => {
    if (coupon.type === "PERCENT") {
      const cap =
        coupon.maxDiscountAmount !== null
          ? ` (up to ₹${coupon.maxDiscountAmount})`
          : "";
      return `${coupon.value}% off${cap}`;
    }
    return `₹${coupon.value} off`;
  };

  return (
    <div className="border border-border-soft bg-card p-6 space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-strong">
        Promo Code
      </p>

      {status === "applied" && appliedCoupon ? (
        /* ---- Applied state ---- */
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 rounded border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 truncate">
                {appliedCoupon.code}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {formatCouponLabel(appliedCoupon)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        </motion.div>
      ) : (
        /* ---- Input state ---- */
        <div className="flex gap-3">
          <Input
            placeholder="Enter coupon code"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              if (status === "error") {
                setStatus("idle");
                setMessage(null);
              }
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled || status === "applying"}
            className="flex-1 uppercase tracking-wider text-sm"
          />
          <Button
            variant="outline"
            onClick={handleApply}
            disabled={
              disabled ||
              status === "applying" ||
              couponCode.trim().length === 0
            }
            className="shrink-0 min-w-[80px]"
          >
            {status === "applying" ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="sr-only">Applying</span>
              </span>
            ) : (
              "Apply"
            )}
          </Button>
        </div>
      )}

      {/* Error message */}
      <AnimatePresence>
        {message && status === "error" && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-red-600 dark:text-red-400"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
