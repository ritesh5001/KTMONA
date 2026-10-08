/**
 * Coupon Admin Service
 * CRUD operations for admin coupon management
 * Separate from CouponService which handles apply/redeem/validate at checkout
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
export class CouponAdminService {
    /**
     * List coupons with pagination and optional filters
     */
    async listCoupons(query) {
        const where = {};
        if (query.isActive === 'true')
            where.isActive = true;
        if (query.isActive === 'false')
            where.isActive = false;
        if (query.type === 'PERCENT' || query.type === 'FLAT') {
            where.type = query.type;
        }
        if (query.search) {
            where.code = { contains: query.search.toUpperCase(), mode: 'insensitive' };
        }
        const skip = (query.page - 1) * query.limit;
        const [coupons, total] = await Promise.all([
            prisma.coupon.findMany({
                where,
                include: {
                    seller: { select: { id: true, email: true, seller_profiles: { select: { store_name: true } } } },
                    _count: { select: { redemptions: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: query.limit,
            }),
            prisma.coupon.count({ where }),
        ]);
        return {
            coupons,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        };
    }
    /**
     * Create a new coupon
     */
    async createCoupon(input) {
        // Check code uniqueness
        const existing = await prisma.coupon.findUnique({ where: { code: input.code } });
        if (existing) {
            throw ApiError.conflict(`Coupon code "${input.code}" already exists`);
        }
        // Validate seller exists if sellerId provided
        if (input.sellerId) {
            const seller = await prisma.user.findUnique({ where: { id: input.sellerId } });
            if (!seller || seller.role !== 'SELLER') {
                throw ApiError.badRequest('Invalid sellerId — user not found or not a seller');
            }
        }
        return prisma.coupon.create({
            data: {
                code: input.code,
                type: input.type,
                value: new Prisma.Decimal(input.value),
                maxDiscountAmount: input.maxDiscountAmount != null
                    ? new Prisma.Decimal(input.maxDiscountAmount)
                    : null,
                minOrderAmount: new Prisma.Decimal(input.minOrderAmount ?? 0),
                usageLimit: input.usageLimit ?? null,
                perUserLimit: input.perUserLimit ?? null,
                validFrom: input.validFrom,
                validUntil: input.validUntil,
                isActive: input.isActive,
                sellerId: input.sellerId ?? null,
                firstTimeUserOnly: input.firstTimeUserOnly,
            },
            include: {
                seller: { select: { id: true, email: true, seller_profiles: { select: { store_name: true } } } },
            },
        });
    }
    /**
     * Update an existing coupon
     */
    async updateCoupon(id, input) {
        const coupon = await prisma.coupon.findUnique({ where: { id } });
        if (!coupon) {
            throw ApiError.notFound('Coupon not found');
        }
        // If code is being changed, ensure uniqueness
        if (input.code && input.code !== coupon.code) {
            const existing = await prisma.coupon.findUnique({ where: { code: input.code } });
            if (existing) {
                throw ApiError.conflict(`Coupon code "${input.code}" already exists`);
            }
        }
        // Validate seller if changing
        if (input.sellerId) {
            const seller = await prisma.user.findUnique({ where: { id: input.sellerId } });
            if (!seller || seller.role !== 'SELLER') {
                throw ApiError.badRequest('Invalid sellerId — user not found or not a seller');
            }
        }
        const data = {};
        if (input.code !== undefined)
            data.code = input.code;
        if (input.type !== undefined)
            data.type = input.type;
        if (input.value !== undefined)
            data.value = new Prisma.Decimal(input.value);
        if (input.maxDiscountAmount !== undefined) {
            data.maxDiscountAmount = input.maxDiscountAmount != null
                ? new Prisma.Decimal(input.maxDiscountAmount)
                : null;
        }
        if (input.minOrderAmount !== undefined)
            data.minOrderAmount = new Prisma.Decimal(input.minOrderAmount);
        if (input.usageLimit !== undefined)
            data.usageLimit = input.usageLimit;
        if (input.perUserLimit !== undefined)
            data.perUserLimit = input.perUserLimit;
        if (input.validFrom !== undefined)
            data.validFrom = input.validFrom;
        if (input.validUntil !== undefined)
            data.validUntil = input.validUntil;
        if (input.isActive !== undefined)
            data.isActive = input.isActive;
        if (input.sellerId !== undefined) {
            data.seller = input.sellerId
                ? { connect: { id: input.sellerId } }
                : { disconnect: true };
        }
        if (input.firstTimeUserOnly !== undefined)
            data.firstTimeUserOnly = input.firstTimeUserOnly;
        return prisma.coupon.update({
            where: { id },
            data,
            include: {
                seller: { select: { id: true, email: true, seller_profiles: { select: { store_name: true } } } },
            },
        });
    }
    /**
     * Delete a coupon (only if it has zero redemptions)
     */
    async deleteCoupon(id) {
        const coupon = await prisma.coupon.findUnique({
            where: { id },
            include: { _count: { select: { redemptions: true } } },
        });
        if (!coupon) {
            throw ApiError.notFound('Coupon not found');
        }
        if (coupon._count.redemptions > 0) {
            throw ApiError.badRequest(`Cannot delete coupon with ${coupon._count.redemptions} existing redemption(s). Deactivate it instead.`);
        }
        await prisma.coupon.delete({ where: { id } });
    }
    /**
     * Toggle coupon active state
     */
    async toggleCoupon(id) {
        const coupon = await prisma.coupon.findUnique({ where: { id } });
        if (!coupon) {
            throw ApiError.notFound('Coupon not found');
        }
        // Don't allow re-activating an expired coupon
        if (!coupon.isActive && coupon.validUntil < new Date()) {
            throw ApiError.badRequest('Cannot re-activate an expired coupon. Update validUntil first.');
        }
        return prisma.coupon.update({
            where: { id },
            data: { isActive: !coupon.isActive },
        });
    }
}
export const couponAdminService = new CouponAdminService();
//# sourceMappingURL=couponAdmin.service.js.map