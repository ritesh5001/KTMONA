import { apiRequest } from "./api";

/** What the Razorpay SDK needs to open for one KTMONA order. */
export interface RazorpayPaymentInit {
  paymentId: string;
  /** Our order id. */
  orderId: string;
  razorpayOrderId: string;
  /** Public key id. */
  keyId: string;
  /** In paise. */
  amount: number;
  currency: string;
  provider: string;
  prefill?: { name?: string; email?: string; contact?: string };
  /** Razorpay customer: Checkout shows (and can save) the buyer's cards/UPI. */
  customerId?: string;
}

export interface InitiatePaymentResponse {
  data: RazorpayPaymentInit;
}

export interface VerifyPaymentResponse {
  data: {
    status: "SUCCESS" | "FAILED" | "PENDING";
    paymentId: string;
    message: string;
  };
}

export interface PaymentDetailsResponse {
  data: { status: string };
}

/** Start (or resume) the Razorpay payment for an order. */
export async function initiatePayment(orderId: string, token?: string | null) {
  return apiRequest<InitiatePaymentResponse>("/v1/payments/initiate", {
    method: "POST",
    body: { orderId },
    token,
  });
}

/**
 * Confirm a Razorpay payment. Pass the ids the SDK returned after paying; with
 * only the order id the backend asks Razorpay for the order's payments instead.
 */
export async function verifyRazorpayPayment(
  input: { orderId: string; razorpayPaymentId?: string; razorpaySignature?: string },
  token?: string | null
) {
  return apiRequest<VerifyPaymentResponse>("/v1/payments/razorpay/verify", {
    method: "POST",
    body: input,
    token,
  });
}

export async function retryPayment(orderId: string, token?: string | null) {
  return apiRequest<InitiatePaymentResponse>(`/v1/payments/retry/${orderId}`, {
    method: "POST",
    body: {},
    token,
  });
}

export async function getPaymentDetails(
  orderId: string,
  token?: string | null,
  signal?: AbortSignal
) {
  return apiRequest<PaymentDetailsResponse>(`/v1/payments/${orderId}`, {
    method: "GET",
    token,
    signal,
  });
}
