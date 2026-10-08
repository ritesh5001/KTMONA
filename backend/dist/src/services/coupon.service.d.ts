import { Prisma } from '@prisma/client';
type TxClient = Prisma.TransactionClient;
interface ApplyCouponInput {
    userId: string;
    couponCode: string;
    orderSubtotal: Prisma.Decimal | number | string;
    sellerIds: string[];
    tx?: TxClient;
}
interface RedeemCouponInput {
    couponId: string;
    userId: string;
    orderId: string;
    discountAmount: Prisma.Decimal;
    tx: TxClient;
}
export declare class CouponService {
    private normalizeCode;
    private withTx;
    applyCouponToOrder(input: ApplyCouponInput): Promise<{
        couponId: string;
        couponCode: string;
        discountAmount: Prisma.Decimal;
    }>;
    redeemCouponAfterOrderCreated(input: RedeemCouponInput): Promise<void>;
    validateCouponCode(userId: string, code: string): Promise<{
        valid: boolean;
        message?: string;
        coupon?: {
            code: string;
            type: string;
            value: number;
            maxDiscountAmount: number | null;
            minOrderAmount: number | null;
        };
    }>;
}
export declare const couponService: CouponService;
export {};
//# sourceMappingURL=coupon.service.d.ts.map