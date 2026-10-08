"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { flushPendingCartWrite } from "@/lib/pending-cart";
import { clearCheckoutCartSnapshot } from "@/lib/checkout-snapshot";
import {
  createFastrrSession,
  loadFastrrCheckout,
  type FastrrSession,
} from "@/services/fastrr";

/**
 * Shiprocket Checkout (Fastrr) launcher.
 *
 * Everything the old checkout page did — address form, coupon box, payment
 * hand-off — happens inside Fastrr's overlay instead. This component's entire
 * job is to get a token, open the overlay, and never leave the buyer looking at
 * a blank screen if that fails.
 *
 * It launches on mount rather than behind another button. The buyer already
 * clicked "Proceed to Checkout"; making them click again is the exact friction
 * an express checkout exists to remove.
 */
export default function FastrrCheckout({
  onFallback,
}: {
  /** Drop to the native address-form checkout without a page reload. */
  onFallback: (reason: string) => void;
}) {
  const [phase, setPhase] = React.useState<"starting" | "open" | "error">(
    "starting"
  );
  const [error, setError] = React.useState<string | null>(null);
  const sessionRef = React.useRef<FastrrSession | null>(null);

  // Strict Mode mounts effects twice in development. Minting two Fastrr sessions
  // for one buyer would leave an orphan session for the sweep to expire, so the
  // launch is guarded rather than relying on the effect running once.
  const launchedRef = React.useRef(false);

  const launch = React.useCallback(async () => {
    setPhase("starting");
    setError(null);

    try {
      // Buy Now navigates here while its add-to-cart is still in flight; without
      // this the token request races it and fails with "Cart is empty".
      await flushPendingCartWrite();

      const session = await createFastrrSession({});
      sessionRef.current = session;

      await loadFastrrCheckout(session);

      if (!window.HeadlessCheckout) {
        throw new Error("Express checkout is unavailable");
      }

      // The cart is about to be consumed by Fastrr. Drop the cached snapshot so
      // a Back-navigation cannot re-launch a stale session.
      clearCheckoutCartSnapshot();

      setPhase("open");

      // `fallbackUrl` is Fastrr's own safety net: if their checkout server is
      // unreachable at click time, they send the buyer here instead of failing.
      window.HeadlessCheckout.addToCart(
        // Their SDK reads this to anchor the overlay; there is no real click
        // event on an auto-launch, so a synthetic one stands in.
        new MouseEvent("click"),
        session.token,
        { fallbackUrl: session.fallbackUrl }
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start express checkout";

      // A cart problem is the buyer's to fix and the native checkout will report
      // it just as well — but anything else (Fastrr down, bundle blocked by an
      // extension) must not strand them. Hand them to the checkout that works.
      if (/cart is empty|no longer in your cart|stock/i.test(message)) {
        setError(message);
        setPhase("error");
        return;
      }

      onFallback(message);
    }
  }, [onFallback]);

  React.useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    void launch();
  }, [launch]);

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-md flex-col items-center gap-8 px-6 py-24 text-center"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
          Secure Checkout
        </p>

        {phase === "error" ? (
          <>
            <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
              We couldn&apos;t open checkout
            </h1>
            <p className="text-sm text-muted-foreground">
              {error ?? "Something went wrong. Please try again."}
            </p>
            <div className="flex w-full flex-col gap-3">
              <Button size="lg" className="h-14 w-full" onClick={() => void launch()}>
                Try Again
              </Button>
              <button
                type="button"
                onClick={() => onFallback("buyer chose standard checkout")}
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                Use Standard Checkout
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
              {phase === "open" ? "Complete Your Order" : "Opening Checkout"}
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              {phase === "open"
                ? "Enter your delivery and payment details in the checkout window to finish your order."
                : "Your pieces are being prepared for checkout. This takes just a moment."}
            </p>

            <div
              aria-hidden
              className="h-px w-24 overflow-hidden bg-border-soft"
            >
              <motion.div
                className="h-full w-1/3 bg-brand"
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            {/* Always reachable. An overlay that fails silently — blocked by an
                extension, dismissed by accident — must never be a dead end. */}
            <button
              type="button"
              onClick={() => onFallback("buyer chose standard checkout")}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              Use Standard Checkout Instead
            </button>
          </>
        )}

        <div className="flex flex-col items-center gap-3 border-t border-border-soft pt-6">
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600/60" />
            Secured by Shiprocket Checkout
          </span>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            KTMONA Buyer Protection
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/** Surfaced by the page so a fallback can explain itself once, not twice. */
export function notifyFastrrFallback(reason: string) {
  if (/buyer chose/i.test(reason)) return;
  toast.message("Continuing with standard checkout", { duration: 5000 });
}
