"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getFastrrSessionStatus } from "@/services/fastrr";

/**
 * Where Shiprocket Checkout (Fastrr) returns the buyer.
 *
 * Fastrr appends `oid` (their order id) and `ost` (SUCCESS / …) to the redirect
 * URL, and `sid` is ours, added when the session was minted. None of those are
 * trusted: `ost=SUCCESS` in a URL bar is a claim anyone can type. The page asks
 * our backend, which asks Fastrr, and only shows an order once one actually
 * exists in our database.
 *
 * Polling rather than waiting for the webhook is deliberate. The buyer arrives
 * here within a second of paying — often before Fastrr's webhook does — and the
 * status endpoint places the order on the spot, so they never see "we're not
 * sure yet" for an order that is already paid.
 */

/** Fastrr's callback lands almost immediately; the order may take a beat. */
const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 15;

type Phase = "checking" | "placed" | "failed" | "unresolved";

export default function FastrrCallbackPage() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("checking");
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string>("");

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("sid");
    const reportedStatus = params.get("ost");

    if (!sessionId) {
      // No session to check. The buyer's orders page is the honest answer —
      // whatever happened, that is where it will show up.
      setPhase("unresolved");
      setMessage("We couldn't identify this checkout.");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const result = await getFastrrSessionStatus(sessionId);
        if (cancelled) return;

        if (result.status === "COMPLETED" && result.orderId) {
          setOrderId(result.orderId);
          setPhase("placed");
          return;
        }

        if (result.status === "FAILED") {
          setPhase("failed");
          setMessage(result.message || "Your payment was not completed.");
          return;
        }

        if (attempts >= MAX_ATTEMPTS) {
          // Still pending after ~30s. Never say "failed" here: the money may
          // well have moved, and the reconciliation sweep will place the order
          // even if every webhook was lost.
          setPhase("unresolved");
          setMessage(
            reportedStatus === "SUCCESS"
              ? "Your payment went through and we're still finalising the order."
              : "We're still confirming this checkout."
          );
          return;
        }

        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;

        if (attempts >= MAX_ATTEMPTS) {
          setPhase("unresolved");
          setMessage("We couldn't reach our servers to confirm this order.");
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-md flex-col items-center gap-8 px-6 py-24 text-center"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
          {phase === "placed" ? "Order Confirmed" : "Secure Checkout"}
        </p>

        {phase === "checking" && (
          <>
            <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
              Confirming Your Order
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              Please don&apos;t close this page — this only takes a moment.
            </p>
            <div aria-hidden className="h-px w-24 overflow-hidden bg-border-soft">
              <motion.div
                className="h-full w-1/3 bg-brand"
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </>
        )}

        {phase === "placed" && (
          <>
            <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
              Thank You
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your order is confirmed. We&apos;ve sent the details to your email.
            </p>
            <div className="flex w-full flex-col gap-3">
              <Button
                size="lg"
                className="h-14 w-full"
                onClick={() => router.push(`/user/orders/${orderId}`)}
              >
                View Your Order
              </Button>
              <button
                type="button"
                onClick={() => router.push("/marketplace")}
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                Continue Exploring
              </button>
            </div>
          </>
        )}

        {phase === "failed" && (
          <>
            <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
              Payment Not Completed
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              {message} Your items are still in your cart.
            </p>
            <div className="flex w-full flex-col gap-3">
              <Button
                size="lg"
                className="h-14 w-full"
                onClick={() => router.push("/checkout")}
              >
                Try Again
              </Button>
              <button
                type="button"
                onClick={() => router.push("/cart")}
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                Back to Cart
              </button>
            </div>
          </>
        )}

        {phase === "unresolved" && (
          <>
            <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
              Almost There
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              {message} It will appear in your orders shortly — no need to pay
              again. Please contact us if it doesn&apos;t.
            </p>
            <div className="flex w-full flex-col gap-3">
              <Button
                size="lg"
                className="h-14 w-full"
                onClick={() => router.push("/user/orders")}
              >
                Go to My Orders
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
