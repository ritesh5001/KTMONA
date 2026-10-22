import { verifyRazorpayPayment, type RazorpayPaymentInit } from "./payments";

/**
 * Native Razorpay checkout (react-native-razorpay).
 *
 * The module is required lazily: it is not in Expo Go, and importing it there
 * throws at module load, which would take the whole checkout screen down
 * instead of just this payment step.
 */

export type RazorpaySdkResult =
  | { status: "paid"; razorpayPaymentId: string; razorpaySignature: string }
  | { status: "cancelled" }
  | { status: "failed"; error: string };

/** Razorpay's code when the buyer closes the sheet without paying. */
const PAYMENT_CANCELLED = 2;

interface RazorpayCheckoutModule {
  open(options: Record<string, unknown>): Promise<{
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }>;
}

function loadSdk(): RazorpayCheckoutModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-razorpay");
    return (mod?.default ?? mod) as RazorpayCheckoutModule;
  } catch {
    throw new Error("Payments need the KTMONA app build. Please update the app and try again.");
  }
}

function describeError(raw: unknown): string {
  const data = raw as { description?: unknown; error?: { description?: string } } | null;
  const description = data?.description;
  if (typeof description === "string") {
    // Android sends the gateway error as a JSON string.
    try {
      const parsed = JSON.parse(description) as { error?: { description?: string } };
      if (parsed?.error?.description) return parsed.error.description;
    } catch {
      return description;
    }
    return description;
  }
  return data?.error?.description ?? "Payment could not be completed.";
}

export async function openRazorpayCheckout(payment: RazorpayPaymentInit): Promise<RazorpaySdkResult> {
  const sdk = loadSdk();
  try {
    const res = await sdk.open({
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
    });
    return {
      status: "paid",
      razorpayPaymentId: res.razorpay_payment_id,
      razorpaySignature: res.razorpay_signature,
    };
  } catch (error) {
    if ((error as { code?: number } | null)?.code === PAYMENT_CANCELLED) {
      return { status: "cancelled" };
    }
    return { status: "failed", error: describeError(error) };
  }
}

/** Re-checks after the first answer is PENDING, giving the webhook time to land. */
const CONFIRM_RECHECK_DELAYS_MS = [1500, 3000, 5000];

/**
 * Ask the backend to confirm a payment the SDK reported as paid. The first call
 * carries the signed ids; if Razorpay has not settled it yet, re-check by order
 * a few times before handing the buyer to their orders page as "pending".
 */
export async function confirmRazorpayPayment(
  orderId: string,
  token: string,
  ids: { razorpayPaymentId: string; razorpaySignature: string }
): Promise<"SUCCESS" | "PENDING"> {
  try {
    const first = await verifyRazorpayPayment({ orderId, ...ids }, token);
    if (first.data.status === "SUCCESS") return "SUCCESS";
  } catch {
    // Fall through to the re-checks.
  }
  for (const delay of CONFIRM_RECHECK_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const res = await verifyRazorpayPayment({ orderId }, token);
      if (res.data.status === "SUCCESS") return "SUCCESS";
    } catch {
      // Keep trying.
    }
  }
  return "PENDING";
}
