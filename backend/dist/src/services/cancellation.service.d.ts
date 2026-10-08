import { CancellationStatus, OrderStatus, PaymentStatus } from '@prisma/client';
export declare class CancellationService {
    private isRetryableTransactionError;
    requestCancellation(userId: string, orderId: string, reason: string): Promise<{
        order: {
            id: string;
            userId: string;
            status: OrderStatus;
        };
    } & import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        orderId: string;
        userId: string;
        reason: string;
        status: CancellationStatus;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    getMyCancellations(userId: string): Promise<{
        cancellations: unknown[];
    }>;
    listCancellations(filters: {
        status?: CancellationStatus;
        userId?: string;
        orderId?: string;
    }): Promise<{
        cancellations: unknown[];
    }>;
    approveCancellation(adminId: string, cancellationId: string): Promise<{
        success: boolean;
        orderId: string;
        paymentStatus: PaymentStatus | null;
        refundTriggered: boolean;
        alreadyCancelled: boolean;
    }>;
    approveCancellationBySeller(sellerId: string, cancellationId: string): Promise<{
        success: boolean;
        orderId: string;
        paymentStatus: PaymentStatus | null;
        refundTriggered: boolean;
        alreadyCancelled: boolean;
    }>;
    private approveCancellationInternal;
    rejectCancellation(adminId: string, cancellationId: string, reason?: string): Promise<{
        success: boolean;
        cancellationId: string;
        orderId: string;
        alreadyRejected: boolean;
    }>;
}
export declare const cancellationService: CancellationService;
//# sourceMappingURL=cancellation.service.d.ts.map