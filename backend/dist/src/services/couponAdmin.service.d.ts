/**
 * Coupon Admin Service
 * CRUD operations for admin coupon management
 * Separate from CouponService which handles apply/redeem/validate at checkout
 */
import { CouponType, Prisma } from '@prisma/client';
import type { CreateCouponInput, UpdateCouponInput } from '../validators/couponAdmin.validation.js';
export declare class CouponAdminService {
    /**
     * List coupons with pagination and optional filters
     */
    listCoupons(query: {
        page: number;
        limit: number;
        isActive?: string | undefined;
        type?: string | undefined;
        search?: string | undefined;
    }): Promise<{
        coupons: ({
            seller: {
                id: string;
                email: string | null;
                seller_profiles: {
                    store_name: string;
                } | null;
            } | null;
            _count: {
                redemptions: number;
            };
        } & import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            code: string;
            type: CouponType;
            value: Prisma.Decimal;
            maxDiscountAmount: Prisma.Decimal | null;
            minOrderAmount: Prisma.Decimal;
            usageLimit: number | null;
            perUserLimit: number | null;
            usedCount: number;
            validFrom: Date;
            validUntil: Date;
            isActive: boolean;
            sellerId: string | null;
            firstTimeUserOnly: boolean;
            createdAt: Date;
        }, unknown> & {})[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Create a new coupon
     */
    createCoupon(input: CreateCouponInput): Promise<{
        seller: {
            id: string;
            email: string | null;
            seller_profiles: {
                store_name: string;
            } | null;
        } | null;
    } & import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        code: string;
        type: CouponType;
        value: Prisma.Decimal;
        maxDiscountAmount: Prisma.Decimal | null;
        minOrderAmount: Prisma.Decimal;
        usageLimit: number | null;
        perUserLimit: number | null;
        usedCount: number;
        validFrom: Date;
        validUntil: Date;
        isActive: boolean;
        sellerId: string | null;
        firstTimeUserOnly: boolean;
        createdAt: Date;
    }, unknown> & {}>;
    /**
     * Update an existing coupon
     */
    updateCoupon(id: string, input: UpdateCouponInput): Promise<{
        seller: {
            id: string;
            email: string | null;
            seller_profiles: {
                store_name: string;
            } | null;
        } | null;
    } & import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        code: string;
        type: CouponType;
        value: Prisma.Decimal;
        maxDiscountAmount: Prisma.Decimal | null;
        minOrderAmount: Prisma.Decimal;
        usageLimit: number | null;
        perUserLimit: number | null;
        usedCount: number;
        validFrom: Date;
        validUntil: Date;
        isActive: boolean;
        sellerId: string | null;
        firstTimeUserOnly: boolean;
        createdAt: Date;
    }, unknown> & {}>;
    /**
     * Delete a coupon (only if it has zero redemptions)
     */
    deleteCoupon(id: string): Promise<void>;
    /**
     * Toggle coupon active state
     */
    toggleCoupon(id: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        code: string;
        type: CouponType;
        value: Prisma.Decimal;
        maxDiscountAmount: Prisma.Decimal | null;
        minOrderAmount: Prisma.Decimal;
        usageLimit: number | null;
        perUserLimit: number | null;
        usedCount: number;
        validFrom: Date;
        validUntil: Date;
        isActive: boolean;
        sellerId: string | null;
        firstTimeUserOnly: boolean;
        createdAt: Date;
    }, unknown> & {}>;
}
export declare const couponAdminService: CouponAdminService;
//# sourceMappingURL=couponAdmin.service.d.ts.map