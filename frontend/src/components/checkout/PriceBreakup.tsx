"use client";

import { Truck } from "lucide-react";
import type { CheckoutQuote } from "@/services/cart";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatInr(value: number) {
  return inr.format(value);
}

/** "Add ₹X more for FREE delivery" with a progress bar, or the unlocked state. */
export function FreeDeliveryProgress({ freeDelivery }: { freeDelivery: CheckoutQuote["freeDelivery"] }) {
  if (!freeDelivery) return null;
  const pct = Math.min(100, Math.round(((freeDelivery.threshold - freeDelivery.remaining) / freeDelivery.threshold) * 100));
  return (
    <div className="space-y-2 rounded-xl border border-border-soft bg-mist/40 p-3">
      <p className="flex items-center gap-2 text-xs text-foreground">
        <Truck className="h-4 w-4 shrink-0 text-brand-strong" strokeWidth={1.8} />
        {freeDelivery.eligible ? (
          <span>
            <strong>Yay! FREE delivery</strong> on this order.
          </span>
        ) : (
          <span>
            Add <strong>{formatInr(freeDelivery.remaining)}</strong> more for <strong>FREE delivery</strong>
          </span>
        )}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-border-soft" aria-hidden>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Every charge before the order is placed — straight from the server quote. */
export function PriceBreakup({ quote, showCouponRow = true }: { quote: CheckoutQuote; showCouponRow?: boolean }) {
  const units = quote.itemCount;
  return (
    <dl className="space-y-3 text-sm">
      <Row label={`Price (${units} item${units === 1 ? "" : "s"})`} value={formatInr(quote.mrpTotal)} />
      {quote.productDiscount > 0 ? (
        <Row label="Discount on MRP" value={`−${formatInr(quote.productDiscount)}`} tone="good" />
      ) : null}
      {showCouponRow && quote.coupon ? (
        <Row label={`Coupon (${quote.coupon.code})`} value={`−${formatInr(quote.coupon.discount)}`} tone="good" />
      ) : null}
      <Row
        label="Delivery charges"
        value={
          quote.shipping > 0 ? (
            formatInr(quote.shipping)
          ) : quote.shippingFee > 0 ? (
            <span>
              <span className="mr-1.5 text-muted-foreground line-through">{formatInr(quote.shippingFee)}</span>
              <span className="text-emerald-700">FREE</span>
            </span>
          ) : (
            <span className="text-emerald-700">FREE</span>
          )
        }
      />
      {quote.gst > 0 ? <Row label="GST" value={formatInr(quote.gst)} /> : null}
      {quote.gstFee > 0 ? <Row label="GST charges" value={formatInr(quote.gstFee)} /> : null}
      <div className="h-px bg-border-soft" />
      <div className="flex items-baseline justify-between">
        <dt className="text-sm font-semibold text-foreground">Total payable</dt>
        <dd className="text-xl font-semibold text-foreground">{formatInr(quote.total)}</dd>
      </div>
      {quote.savings > 0 ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          You save {formatInr(quote.savings)} on this order
        </p>
      ) : null}
    </dl>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={tone === "good" ? "text-emerald-700" : "text-foreground"}>{value}</dd>
    </div>
  );
}
