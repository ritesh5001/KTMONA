import { CouponType, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { couponLogger } from '../config/logger.js';
import { couponAppliedTotal, couponRejectedTotal, couponUsageExhaustedTotal, couponDiscountAmountTotal, } from '../config/metrics.js';
function toDecimal(value) {
    if (value instanceof Prisma.Decimal)
        return value;
    return new Prisma.Decimal(value);
}
function round2(value) {
    return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
export class CouponService {
    normalizeCode(code) {
        return code.trim().toUpperCase();
    }
    async withTx(tx, fn) {
        if (tx)
            return fn(tx);
        return prisma.$transaction((trx) => fn(trx));
    }
    async applyCouponToOrder(input) {
        return this.withTx(input.tx, async (tx) => {
            const code = this.normalizeCode(input.couponCode);
            const orderSubtotal = round2(toDecimal(input.orderSubtotal));
            couponLogger.info({ event: 'coupon_apply_attempt', code, userId: input.userId }, 'Coupon apply attempt');
            if (orderSubtotal.lte(0)) {
                couponRejectedTotal.inc();
                throw ApiError.badRequest('Order subtotal must be greater than 0 for coupon application');
            }
            await tx.$queryRaw `
                SELECT id
                FROM "coupons"
                WHERE code = ${code}
                FOR UPDATE
            `;
            const coupon = await tx.coupon.findUnique({ where: { code } });
            if (!coupon) {
                couponRejectedTotal.inc();
                couponLogger.info({ event: 'coupon_apply_rejected', code, reason: 'not_found' }, 'Coupon rejected');
                throw ApiError.badRequest('Invalid coupon code');
            }
            if (!coupon.isActive) {
                couponRejectedTotal.inc();
                couponLogger.info({ event: 'coupon_apply_rejected', code, reason: 'inactive' }, 'Coupon rejected');
                throw ApiError.badRequest('Coupon is inactive');
            }
            const now = new Date();
            if (coupon.validFrom > now || coupon.validUntil < now) {
                couponRejectedTotal.inc();
                couponLogger.info({ event: 'coupon_apply_rejected', code, reason: 'outside_validity_window' }, 'Coupon rejected');
                throw ApiError.badRequest('Coupon is expired or not yet active');
            }
            if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
                couponRejectedTotal.inc();
                couponUsageExhaustedTotal.inc();
                couponLogger.info({ event: 'coupon_apply_rejected', code, reason: 'usage_limit_exhausted' }, 'Coupon rejected');
                throw ApiError.badRequest('Coupon usage limit exhausted');
            }
            if (coupon.perUserLimit !== null) {
                const userCount = await tx.couponRedemption.count({
                    where: { couponId: coupon.id, userId: input.userId },
                });
                if (userCount >= coupon.perUserLimit) {
                    couponRejectedTotal.inc();
                    couponLogger.info({ event: 'coupon_apply_rejected', code, reason: 'per_user_limit_exhausted' }, 'Coupon rejected');
                    throw ApiError.badRequest('Per-user coupon limit exhausted');
                }
            }
            if (orderSubtotal.lt(coupon.minOrderAmount)) {
                couponRejectedTotal.inc();
                couponLogger.info({
                    event: 'coupon_apply_rejected',
                    code,
                    reason: 'min_order_not_met',
                    minOrderAmount: coupon.minOrderAmount.toString(),
                    orderSubtotal: orderSubtotal.toString(),
                }, 'Coupon rejected');
                throw ApiError.badRequest('Minimum order amount not satisfied for this coupon');
            }
            if (coupon.firstTimeUserOnly) {
                const paidOrders = await tx.payment.count({
                    where: {
                        userId: input.userId,
                        status: { in: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED] },
                    },
                });
                if (paidOrders > 0) {
                    couponRejectedTotal.inc();
                    couponLogger.info({ event: 'coupon_apply_rejected', code, reason: 'first_time_user_only' }, 'Coupon rejected');
                    throw ApiError.badRequest('Coupon is valid for first-time users only');
                }
            }
            if (coupon.sellerId && !input.sellerIds.includes(coupon.sellerId)) {
                couponRejectedTotal.inc();
                couponLogger.info({ event: 'coupon_apply_rejected', code, reason: 'seller_mismatch' }, 'Coupon rejected');
                throw ApiError.badRequest('Coupon is not applicable to items in this cart');
            }
            let discount = coupon.type === CouponType.PERCENT
                ? orderSubtotal.mul(coupon.value).div(100)
                : new Prisma.Decimal(coupon.value);
            if (coupon.maxDiscountAmount && discount.gt(coupon.maxDiscountAmount)) {
                discount = new Prisma.Decimal(coupon.maxDiscountAmount);
            }
            if (discount.gt(orderSubtotal)) {
                discount = orderSubtotal;
            }
            discount = round2(discount);
            couponAppliedTotal.inc();
            couponDiscountAmountTotal.inc(Number(discount.toString()));
            couponLogger.info({
                event: 'coupon_apply_success',
                code,
                userId: input.userId,
                discountAmount: discount.toString(),
            }, 'Coupon applied successfully');
            return {
                couponId: coupon.id,
                couponCode: coupon.code,
                discountAmount: discount,
            };
        });
    }
    async redeemCouponAfterOrderCreated(input) {
        const existing = await input.tx.couponRedemption.findFirst({
            where: {
                couponId: input.couponId,
                userId: input.userId,
                orderId: input.orderId,
            },
        });
        if (existing)
            return;
        await input.tx.couponRedemption.create({
            data: {
                couponId: input.couponId,
                userId: input.userId,
                orderId: input.orderId,
                discountAmount: round2(input.discountAmount),
            },
        });
        const coupon = await input.tx.coupon.findUnique({ where: { id: input.couponId } });
        if (!coupon) {
            throw ApiError.notFound('Coupon not found during redemption');
        }
        if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
            throw ApiError.conflict('Coupon usage limit exhausted during redemption');
        }
        await input.tx.coupon.update({
            where: { id: input.couponId },
            data: {
                usedCount: { increment: 1 },
            },
        });
    }
    async validateCouponCode(userId, code) {
        const normalized = this.normalizeCode(code);
        const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
        if (!coupon) {
            return { valid: false, message: 'Invalid coupon code' };
        }
        if (!coupon.isActive) {
            return { valid: false, message: 'Coupon is inactive' };
        }
        const now = new Date();
        if (coupon.validFrom > now || coupon.validUntil < now) {
            return { valid: false, message: 'Coupon is expired or not yet active' };
        }
        if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
            return { valid: false, message: 'Coupon usage limit exhausted' };
        }
        if (coupon.perUserLimit !== null) {
            const userCount = await prisma.couponRedemption.count({
                where: { couponId: coupon.id, userId },
            });
            if (userCount >= coupon.perUserLimit) {
                return { valid: false, message: 'Per-user coupon limit exhausted' };
            }
        }
        return {
            valid: true,
            coupon: {
                code: coupon.code,
                type: coupon.type,
                value: Number(coupon.value),
                maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
                minOrderAmount: coupon.minOrderAmount ? Number(coupon.minOrderAmount) : null,
            },
        };
    }
}
export const couponService = new CouponService();
//# sourceMappingURL=coupon.service.js.map