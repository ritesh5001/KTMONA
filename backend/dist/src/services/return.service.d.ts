import { OrderStatus, PaymentStatus, ReturnStatus } from '@prisma/client';
interface ReturnItemInput {
    orderItemId: string;
    quantity: number;
    reason?: string | undefined;
}
export declare class ReturnService {
    requestReturn(userId: string, orderId: string, reason: string, items: ReturnItemInput[]): Promise<{
        items: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            returnRequestId: string;
            orderItemId: string;
            variantId: string;
            quantity: number;
            reason: string | null;
        }, unknown> & {})[];
    } & import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        orderId: string;
        userId: string;
        reason: string;
        status: ReturnStatus;
        refundAmount: number | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    getMyReturns(userId: string): Promise<{
        returns: unknown[];
    }>;
    getReturnById(userId: string, returnId: string): Promise<{
        items: ({
            orderItem: {
                id: string;
                productId: string;
                variantId: string;
                quantity: number;
                priceSnapshot: number;
            };
        } & import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            returnRequestId: string;
            orderItemId: string;
            variantId: string;
            quantity: number;
            reason: string | null;
        }, unknown> & {})[];
        order: {
            id: string;
            status: OrderStatus;
            totalAmount: number;
            createdAt: Date;
        };
    } & import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        orderId: string;
        userId: string;
        reason: string;
        status: ReturnStatus;
        refundAmount: number | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    listReturns(filters: {
        status?: ReturnStatus;
        userId?: string;
        orderId?: string;
    }): Promise<{
        returns: unknown[];
    }>;
    approveReturn(adminId: string, returnId: string): Promise<{
        success: boolean;
        orderId: string;
        paymentStatus: PaymentStatus | null;
        alreadyApproved: boolean;
    }>;
    rejectReturn(adminId: string, returnId: string, reason?: string): Promise<{
        success: boolean;
        returnId: string;
        orderId: string;
        alreadyRejected: boolean;
    }>;
    processReturnRefund(adminId: string, returnId: string): Promise<{
        success: boolean;
        returnId: string;
        alreadyRefunded: boolean;
        refundTriggered?: never;
    } | {
        success: boolean;
        returnId: string;
        refundTriggered: boolean;
        alreadyRefunded: boolean;
    }>;
}
export declare const returnService: ReturnService;
export {};
//# sourceMappingURL=return.service.d.ts.map