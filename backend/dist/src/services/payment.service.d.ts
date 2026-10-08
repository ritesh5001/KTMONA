import { PaymentStatus, PaymentProvider } from '@prisma/client';
/** Where the buyer lands after a PhonePe redirect-flow payment. */
export type PaymentPlatform = 'WEB' | 'MOBILE';
export declare class PaymentService {
    private findOrderForPayment;
    /**
     * The amount to charge for an order.
     *
     * This is `grandTotal` and nothing else. Checkout is the single place that prices an
     * order: it applies the coupon, computes CGST/SGST/IGST, adds the flat GST fee and
     * the shipping fee (when the admin has them enabled) and writes the result to
     * `grandTotal` — so re-deriving anything here can only disagree with what the buyer
     * was shown.
     *
     * A previous version tried to be defensive by taking
     * `max(totalAmount, grandTotal, subTotal + tax + shipping)`, inferring the shipping
     * fee as `grandTotal - subTotal - tax` and falling back to a hardcoded ₹180 when
     * that came out as 0. But 0 is the correct, normal answer whenever the admin has the
     * shipping charge switched off — so the fallback fired on ordinary orders and
     * charged every buyer ₹180 more than their order total.
     */
    private resolvePayableAmount;
    /**
     * Where PhonePe redirects the buyer after checkout.
     * WEB → frontend callback page; MOBILE → app deep link (if configured).
     */
    private buildPhonePeRedirectUrl;
    initiatePayment(userId: string, orderId: string, platform?: PaymentPlatform): Promise<{
        paymentId: string;
        orderId: string;
        phonepeOrderId: string;
        sdkToken: string;
        sdkExpireAt: number;
        merchantId: string;
        environment: "SANDBOX" | "PRODUCTION";
        amount: number;
        currency: string;
        provider: string;
        redirectUrl?: never;
    } | {
        paymentId: string;
        orderId: string;
        phonepeOrderId: string;
        redirectUrl: string;
        amount: number;
        currency: string;
        provider: string;
        sdkToken?: never;
        sdkExpireAt?: never;
        merchantId?: never;
        environment?: never;
    }>;
    /** Retry payment for a PLACED order whose payment is FAILED/INITIATED. */
    retryPayment(userId: string, orderId: string, platform?: PaymentPlatform): Promise<{
        paymentId: string;
        orderId: string;
        phonepeOrderId: string;
        sdkToken: string;
        sdkExpireAt: number;
        merchantId: string;
        environment: "SANDBOX" | "PRODUCTION";
        amount: number;
        currency: string;
        provider: string;
        redirectUrl?: never;
    } | {
        paymentId: string;
        orderId: string;
        phonepeOrderId: string;
        redirectUrl: string;
        amount: number;
        currency: string;
        provider: string;
        sdkToken?: never;
        sdkExpireAt?: never;
        merchantId?: never;
        environment?: never;
    }>;
    verifyPhonePePayment(userId: string, orderId: string): Promise<{
        status: 'SUCCESS' | 'FAILED' | 'PENDING';
        paymentId: string;
        message: string;
    }>;
    processRefund(orderId: string): Promise<{
        refundTriggered: boolean;
        alreadyRefunded: boolean;
        paymentStatus: PaymentStatus | null;
    }>;
    getPaymentDetails(orderId: string, userId: string): Promise<{
        id: string;
        orderId: string;
        userId: string;
        amount: number;
        currency: string;
        status: PaymentStatus;
        provider: PaymentProvider;
        providerOrderId: string | null;
        providerPaymentId: string | null;
        providerSignature: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    handlePaymentSuccess(paymentId: string, orderId: string, providerPaymentId: string, payload: any, providerSignature?: string): Promise<void>;
    handlePaymentFailure(paymentId: string, payload: any): Promise<void>;
    cancelStaleOrders(): Promise<{
        cancelled: number;
        total: number;
    }>;
}
export declare const paymentService: PaymentService;
//# sourceMappingURL=payment.service.d.ts.map