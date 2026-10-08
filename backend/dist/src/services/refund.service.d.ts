import { RefundInitiator, RefundStatus, PaymentProvider } from '@prisma/client';
interface CreateRefundInput {
    orderId: string;
    /** Amount in paise (integer). 100 paise = ₹1 */
    amount: number;
    reason?: string;
    initiatedBy: RefundInitiator;
}
export declare class RefundService {
    /**
     * Create a refund ledger entry and execute refund via payment provider.
     *
     * Rules:
     *  - Idempotent: if SUCCESS refund for same order+amount exists → returns it
     *  - Over-refund prevention: sum(SUCCESS + PENDING) + amount <= order.totalAmount (in paise)
     *  - PENDING row created inside transaction
     *  - Provider call outside transaction
     *  - Final status update uses optimistic lock (WHERE status = PENDING)
     *  - Failed records are NEVER deleted (immutable audit trail)
     */
    createRefund(input: CreateRefundInput): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        orderId: string;
        paymentId: string;
        amount: number;
        reason: string | null;
        status: RefundStatus;
        razorpayRefundId: string | null;
        initiatedBy: RefundInitiator;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    /**
     * List all refunds (admin view).
     */
    listRefunds(filters?: {
        orderId?: string;
        status?: RefundStatus;
    }): Promise<{
        refunds: ({
            order: {
                id: string;
                totalAmount: number;
                status: import(".prisma/client").OrderStatus;
            };
            payment: {
                id: string;
                provider: PaymentProvider;
                providerPaymentId: string | null;
            };
        } & import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            orderId: string;
            paymentId: string;
            amount: number;
            reason: string | null;
            status: RefundStatus;
            razorpayRefundId: string | null;
            initiatedBy: RefundInitiator;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {})[];
    }>;
}
export declare const refundService: RefundService;
export {};
//# sourceMappingURL=refund.service.d.ts.map