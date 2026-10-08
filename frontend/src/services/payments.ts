import { apiRequest, CHECKOUT_REQUEST_TIMEOUT_MS } from "@/services/api";

export interface InitiatePaymentResponse {
  data: {
    paymentId: string;
    orderId: string;
    phonepeOrderId?: string;
    /** PhonePe hosted checkout page — redirect the buyer here. */
    redirectUrl?: string;
    amount: number;
    currency: string;
    provider: string;
  };
}

export interface PhonePeVerifyResponse {
  data: {
    status: "SUCCESS" | "FAILED" | "PENDING";
    paymentId: string;
    message: string;
  };
}

export interface PaymentDetailsResponse {
  data: { status: string };
}

/** Initiate a PhonePe payment for an order → returns a redirectUrl. */
export async function initiatePayment(orderId: string, token?: string | null) {
  return apiRequest<InitiatePaymentResponse>("/v1/payments/initiate", {
    method: "POST",
    body: { orderId, platform: "WEB" },
    token,
    timeoutMs: CHECKOUT_REQUEST_TIMEOUT_MS,
  });
}

/**
 * Confirm a PhonePe payment after the redirect back (or while polling).
 * The backend checks the authoritative state with PhonePe's Order Status API.
 */
export async function verifyPhonePePayment(orderId: string, token?: string | null) {
  return apiRequest<PhonePeVerifyResponse>("/v1/payments/phonepe/verify", {
    method: "POST",
    body: { orderId },
    token,
  });
}

export async function retryPayment(orderId: string, token?: string | null) {
  return apiRequest<InitiatePaymentResponse>(`/v1/payments/retry/${orderId}`, {
    method: "POST",
    body: { platform: "WEB" },
    token,
    timeoutMs: CHECKOUT_REQUEST_TIMEOUT_MS,
  });
}

export async function getPaymentDetails(orderId: string, token?: string | null) {
  return apiRequest<PaymentDetailsResponse>(`/v1/payments/${orderId}`, {
    method: "GET",
    token,
  });
}
