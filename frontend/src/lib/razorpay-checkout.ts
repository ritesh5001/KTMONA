import type { RazorpayPaymentInit } from "@/services/payments";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export type RazorpayCheckoutResult =
  | { status: "paid"; razorpayPaymentId: string; razorpaySignature: string }
  | { status: "dismissed"; lastError?: string };

let loading: Promise<void> | null = null;

/** Load checkout.js once. Safe to call early (e.g. on checkout mount). */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay needs a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Could not load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

/**
 * Open Razorpay Checkout and resolve once the buyer pays or closes it.
 *
 * A failed attempt does not resolve: Checkout lets the buyer try another
 * method on the same order, so only success or closing the window ends it.
 */
export async function openRazorpayCheckout(payment: RazorpayPaymentInit): Promise<RazorpayCheckoutResult> {
  await loadRazorpayCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Could not load the payment window. Please try again.");

  return new Promise<RazorpayCheckoutResult>((resolve) => {
    let lastError: string | undefined;
    const checkout = new Razorpay({
      key: payment.keyId,
      order_id: payment.razorpayOrderId,
      amount: payment.amount,
      currency: payment.currency,
      name: "KTMONA",
      description: "Order payment",
      prefill: payment.prefill ?? {},
      ...(payment.customerId ? { customer_id: payment.customerId, remember_customer: true } : {}),
      notes: { orderId: payment.orderId },
      theme: { color: "#0C1B42" },
      handler: (response: RazorpaySuccess) =>
        resolve({
          status: "paid",
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      modal: {
        // Closing the window is not a failed payment; the order stays payable.
        ondismiss: () => resolve({ status: "dismissed", lastError }),
        confirm_close: true,
      },
    });
    checkout.on("payment.failed", (response) => {
      lastError = response.error?.description;
    });
    checkout.open();
  });
}
