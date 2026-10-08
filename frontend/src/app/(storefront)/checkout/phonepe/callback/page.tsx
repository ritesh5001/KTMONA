"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { verifyPhonePePayment } from "@/services/payments";

/**
 * Poll fast at first, then back off.
 *
 * A payment is usually already COMPLETED by the time PhonePe sends the buyer back,
 * so the answer normally arrives on the first or second check. A flat 3s interval
 * made people stare at a spinner for up to three extra seconds after their money had
 * already moved. Backing off keeps the same overall window (~60s) without hammering
 * PhonePe's status API for the rare payment that genuinely takes a while.
 */
function pollDelayMs(attempt: number): number {
  if (attempt < 4) return 700;
  if (attempt < 9) return 1500;
  return 3000;
}

const MAX_POLLS = 26; // ~60s of PENDING before we hand off to the webhook

/** How long to let the buyer see the success state before moving them on. */
const SUCCESS_DWELL_MS = 1200;

type Phase = "verifying" | "success" | "failed" | "pending";

function PhonePeCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // PhonePe may drop our ?orderId= on the return, so fall back to the id we
  // stashed before redirecting.
  const [orderId] = React.useState<string | null>(() => {
    const fromQuery = searchParams.get("orderId");
    if (fromQuery) return fromQuery;
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem("ktmona_pending_order");
    } catch {
      return null;
    }
  });

  const [phase, setPhase] = React.useState<Phase>("verifying");
  const [message, setMessage] = React.useState("Confirming your payment with PhonePe…");

  React.useEffect(() => {
    if (!orderId) {
      setPhase("failed");
      setMessage("Missing order reference. Please check your orders.");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const clearPending = () => {
      try {
        window.sessionStorage.removeItem("ktmona_pending_order");
      } catch {
        // ignore
      }
    };

    const check = async () => {
      try {
        const result = await verifyPhonePePayment(orderId);
        if (cancelled) return;

        if (result.data.status === "SUCCESS") {
          clearPending();
          setPhase("success");
          setMessage("Payment successful. Your order is confirmed.");
          setTimeout(() => {
            if (!cancelled) router.push("/user/orders");
          }, SUCCESS_DWELL_MS);
          return;
        }

        if (result.data.status === "FAILED") {
          clearPending();
          setPhase("failed");
          setMessage("Payment failed. You can retry from your orders.");
          return;
        }

        attempts += 1;
        if (attempts >= MAX_POLLS) {
          setPhase("pending");
          setMessage(
            "Your payment is still being processed. We'll confirm it shortly — check your orders for the latest status."
          );
          return;
        }
        setTimeout(() => {
          if (!cancelled) void check();
        }, pollDelayMs(attempts));
      } catch {
        if (cancelled) return;

        // A verification error is not a failed payment — it usually means the
        // gateway or our API hiccuped. Telling the buyer "Payment Not Completed"
        // with a raw server message is both alarming and frequently wrong, since
        // the webhook may still settle the order as paid. Retry, then hand them
        // to their orders rather than passing a 500 through to the page.
        attempts += 1;
        if (attempts < MAX_POLLS) {
          setTimeout(() => {
            if (!cancelled) void check();
          }, pollDelayMs(attempts));
          return;
        }

        setPhase("pending");
        setMessage(
          "We couldn't confirm your payment just yet. If money was debited, your order will update automatically — check your orders in a moment."
        );
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-border-soft bg-card p-10 text-center space-y-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
          PhonePe Payment
        </p>

        {phase === "verifying" && (
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        )}
        {phase === "success" && (
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-600/10 text-2xl text-green-600">
            ✓
          </span>
        )}
        {phase === "failed" && (
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-600/10 text-2xl text-red-600">
            ✕
          </span>
        )}
        {phase === "pending" && (
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-2xl text-brand-strong">
            ⏳
          </span>
        )}

        <h1 className="font-serif text-2xl font-light tracking-tight text-foreground">
          {phase === "verifying"
            ? "Verifying Payment"
            : phase === "success"
              ? "Payment Confirmed"
              : phase === "failed"
                ? "Payment Not Completed"
                : "Payment Processing"}
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>

        {phase !== "verifying" && (
          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={() => router.push("/user/orders")}>
              View My Orders
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PhonePeCallbackPage() {
  return (
    <React.Suspense fallback={null}>
      <PhonePeCallbackContent />
    </React.Suspense>
  );
}
