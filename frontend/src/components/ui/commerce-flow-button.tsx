"use client";

import * as React from "react";
import { ArrowRight, CreditCard, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

export type CommerceFlowAction = "cart" | "buy";

export interface CommerceFlowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  action: CommerceFlowAction;
  variant?: "filled" | "outline";
}

/**
 * Flow action shared by every website Add to Cart and Buy Now CTA.
 *
 * On hover a disc grows from the centre until it covers the button, the resting
 * commerce icon collapses out to the right and an arrow opens up on the left.
 * Its named group prevents a surrounding product-card hover from activating it.
 *
 * The icons ride in the flex row rather than being pinned to the button edges,
 * and they open and close by cancelling their own width with a negative margin.
 * That keeps the text-to-icon gap at exactly `gap-3` in both states — an
 * edge-pinned icon drifts further from the label the wider the button gets.
 *
 * Every transition names `scale` and `translate` explicitly: Tailwind v4 emits
 * those as standalone CSS properties, so a `transition-[transform]` never
 * animates them and the fill lands in a single frame.
 */
export const CommerceFlowButton = React.forwardRef<
  HTMLButtonElement,
  CommerceFlowButtonProps
>(function CommerceFlowButton(
  {
    action,
    variant = "outline",
    className,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const Icon = action === "cart" ? ShoppingCart : CreditCard;
  const filled = variant === "filled";

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        // A container, not just a group: the icons need room, and a product-card
        // button on a phone is a third the width of the same button on the detail
        // page. The query keys off the button, so one component adapts to a 2-up
        // grid and a full-width CTA without a viewport guess.
        "group/flow @container/flow relative isolate inline-flex h-12 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border px-4 @max-[180px]/flow:px-2",
        "transition-[color,border-color,box-shadow,scale] duration-600 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        filled
          // Border tracks the fill on hover — the disc grows gold, so a fixed
          // charcoal border would sit as a visible ring around it.
          ? "border-ink bg-ink text-white hover:border-brand hover:shadow-[0_6px_20px_rgba(255,138,0,0.30)]"
          : "border-ink bg-background text-ink hover:text-white hover:shadow-[0_6px_20px_rgba(12,27,66,0.20)] focus-visible:text-white",
        className
      )}
      {...props}
    >
      {/* Sized off the button's own width so the disc always outgrows the button
          it fills — a fixed scale factor that covers a 150px card button falls
          short on a full-width product-detail one. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 z-0 aspect-square w-[135%] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full opacity-0",
          "transition-[scale,opacity] duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]",
          "group-hover/flow:scale-100 group-hover/flow:opacity-100",
          "group-focus-visible/flow:scale-100 group-focus-visible/flow:opacity-100",
          filled ? "bg-brand" : "bg-ink"
        )}
      />

      <span className="relative z-10 inline-flex items-center gap-3">
        {/* -ml-7 is exactly the arrow's own width plus the gap, so at rest it
            occupies nothing and the label sits dead centre. Below 180px both
            icons stand down instead of crowding the label — the fill still
            reads as the same gesture. */}
        <ArrowRight
          aria-hidden
          className={cn(
            "-ml-7 h-4 w-4 shrink-0 opacity-0 @max-[180px]/flow:hidden",
            "transition-[margin,opacity] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
            "group-hover/flow:ml-0 group-hover/flow:opacity-100",
            "group-focus-visible/flow:ml-0 group-focus-visible/flow:opacity-100"
          )}
          strokeWidth={1.8}
        />

        <span className="whitespace-nowrap">{children}</span>

        <Icon
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 @max-[180px]/flow:hidden",
            "transition-[margin,opacity] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
            "group-hover/flow:-mr-7 group-hover/flow:opacity-0",
            "group-focus-visible/flow:-mr-7 group-focus-visible/flow:opacity-0"
          )}
          strokeWidth={1.8}
        />
      </span>
    </button>
  );
});

CommerceFlowButton.displayName = "CommerceFlowButton";
