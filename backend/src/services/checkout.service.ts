import { prisma } from '../config/db.js';
import { CartRepository, cartRepository } from '../repositories/cart.repository.js';
import {
    invalidateCache,
    invalidateCacheByPattern,
    CACHE_KEYS,
} from '../utils/cache.util.js';
import { emitOrderPlaced } from '../events/order.events.js';
import { ApiError } from '../errors/ApiError.js';
import type { CheckoutResponse } from '../types/order.types.js';
import { checkoutLogger, inventoryLogger } from '../config/logger.js';
import {
    inventoryReserveAttemptTotal,
    checkoutSuccessTotal,
    checkoutFailTotal,
    gstCalculationTotal,
    igstAppliedTotal,
    intraStateOrderTotal,
} from '../config/metrics.js';
import { recordReserveAttempt, recordReserveFailure } from '../monitoring/alerts.js';
import { couponService } from './coupon.service.js';
import { settingsService, FLAT_GST_FEE_INR } from './settings.service.js';
import { Prisma } from '@prisma/client';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, orderTag, productTag } from '../live/cache-tags.js';

const round2 = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const MAX_CHECKOUT_ITEMS = 20;

/**
 * Checkout Service
 * Handles the checkout process with atomic inventory reservation.
 *
 * Concurrency strategy:
 *   1. Validate cart items and pricing outside the transaction (read-only).
 *   2. Inside a serialised $transaction:
 *      a. Atomically decrement stock using `updateMany WHERE stock >= qty`.
 *         If ANY row returns count=0 → rollback entire transaction (no partial reservation).
 *      b. Create order + items in the same tx.
 *      c. Create RESERVE movements for audit trail.
 *      d. Clear cart.
 *   3. Cache invalidation + notifications happen outside the tx (best-effort).
 *
 * This guarantees:
 *   - Two users cannot buy the last unit simultaneously.
 *   - Stock can never go negative at the database level.
 *   - No partial reservations — all-or-nothing.
 */
export class CheckoutService {
    constructor(private readonly cartRepo: CartRepository) { }

    /**
     * Process checkout — atomic, concurrency-safe
     */
    async checkout(
        userId: string,
        shipping?: {
            shippingName?: string;
            shippingPhone?: string;
            shippingEmail?: string;
            shippingAddressLine1?: string;
            shippingAddressLine2?: string;
            shippingCity?: string;
            shippingPincode?: string;
            shippingNotes?: string;
        },
        couponCode?: string,
        /**
         * Buy-now: restrict this checkout to these variants. Omitted means the
         * whole cart. Anything not selected stays in the cart untouched.
         */
        variantIds?: string[],
    ): Promise<CheckoutResponse> {
        // =====================================================================
        // PHASE 1 — Read-only validation (outside transaction)
        // =====================================================================

        // One batched load (2 queries) covers the cart, its products, each product's
        // taxRate, the seller's state and the exact variants with pricing + stock.
        // The buyer's state and the two app settings are independent of all of it, so
        // they ride along in the same round-trip instead of being awaited in series.
        const [cartRows, buyer, shippingFee, gstChargeEnabled] = await Promise.all([
            this.cartRepo.getCartForCheckout(userId),
            prisma.user.findUnique({
                where: { id: userId },
                select: { state: true },
            }),
            settingsService.getShippingFee(true),
            settingsService.isGstChargeEnabled(),
        ]);
        if (cartRows.length === 0) {
            throw ApiError.badRequest('Cart is empty');
        }

        const cartId = cartRows[0]!.cartId;

        // Narrow to the buy-now selection before any pricing or stock work, so the
        // rest of the flow is identical whether this is one item or the full cart.
        const selectedVariantIds = variantIds?.length ? new Set(variantIds) : null;
        const selectedRows = selectedVariantIds
            ? cartRows.filter((row) => selectedVariantIds.has(row.variantId))
            : cartRows;

        if (selectedRows.length === 0) {
            throw ApiError.badRequest('The selected item is no longer in your cart');
        }

        if (selectedRows.length > MAX_CHECKOUT_ITEMS) {
            throw ApiError.badRequest(`Cart cannot contain more than ${MAX_CHECKOUT_ITEMS} items per checkout`);
        }

        const validationErrors: string[] = [];
        const itemsWithStock: Array<{
            variantId: string;
            productId: string;
            sellerId: string;
            quantity: number;
            priceSnapshot: number;
            sellerPriceSnapshot: number;
            adminPriceSnapshot: number;
            platformMargin: number;
            taxRate: number;
            sellerState: string;
            buyerState: string;
            lineSubtotal: Prisma.Decimal;
        }> = [];

        const buyerState = buyer?.state ?? '';

        // Each row already carries its product, variant, stock and seller state from the
        // single JOIN above — no further queries, no lookup maps needed.
        for (const item of selectedRows) {
            const title = item.productTitle ?? 'this item';

            if (item.sellerId == null || item.variantStatus == null || item.variantPrice == null) {
                validationErrors.push(`Product or variant not found for item ${item.itemId}`);
                continue;
            }

            const availableStock = item.stock;

            if (item.productDeleted || item.productStatus !== 'APPROVED') {
                validationErrors.push(`${title} is no longer available for purchase`);
                continue;
            }

            if (item.variantStatus !== 'APPROVED') {
                validationErrors.push(`Selected variant is pending approval for ${title}`);
                continue;
            }

            const adminListingPrice = Number(item.variantPrice);
            const sellerPrice = Number(item.variantSellerPrice ?? 0);
            const margin = adminListingPrice - sellerPrice;

            if (margin < 0) {
                validationErrors.push(`Invalid pricing state for ${title}`);
                continue;
            }

            const productTaxRate = item.taxRate ?? 0;
            const sellerState = item.sellerState;

            if (item.quantity > availableStock) {
                validationErrors.push(
                    `Insufficient stock for ${title}: Available ${availableStock}, Requested ${item.quantity}`
                );
            } else {
                itemsWithStock.push({
                    variantId: item.variantId,
                    productId: item.productId,
                    sellerId: item.sellerId,
                    quantity: item.quantity,
                    priceSnapshot: adminListingPrice,
                    sellerPriceSnapshot: sellerPrice,
                    adminPriceSnapshot: adminListingPrice,
                    platformMargin: margin,
                    taxRate: productTaxRate,
                    sellerState,
                    buyerState,
                    lineSubtotal: new Prisma.Decimal(adminListingPrice).mul(item.quantity),
                });
            }
        }

        if (validationErrors.length > 0) {
            throw ApiError.badRequest(validationErrors.join('; '));
        }

        // Calculate pre-tax subtotal only. GST is calculated after coupon discount allocation.
        const orderSubtotal = itemsWithStock.reduce(
            (sum, item) => sum.add(item.lineSubtotal),
            new Prisma.Decimal(0),
        );
        // shippingFee and gstChargeEnabled were resolved in the batched load above —
        // outside the transaction, so no DB reads happen while holding row locks.

        // =====================================================================
        // PHASE 2 — Atomic transaction: reserve stock + create order + clear cart
        // =====================================================================

        checkoutLogger.info({ event: 'checkout_attempt', userId, itemCount: itemsWithStock.length }, 'Checkout attempt started');

        const order = await prisma.$transaction(async (tx) => {
            // 2a. Atomic stock reservation — decrement only where there is enough
            //     stock, for EVERY item in a single statement.
            //
            //     This was a loop issuing one updateMany per item. Inside a
            //     transaction those run strictly one after another, and a round-trip
            //     from the API to the database costs ~2.3s in production — so a
            //     three-item cart spent ~7s here alone.
            //
            //     The guard is unchanged: `stock >= qty` per row, and we still fail
            //     the whole checkout unless every item was reserved. RETURNING tells
            //     us exactly which ones succeeded, so the error stays specific, and
            //     throwing still rolls the transaction back — no partial reservation.
            for (const item of itemsWithStock) {
                recordReserveAttempt();
                inventoryReserveAttemptTotal.inc({ variantId: item.variantId });
            }

            const reserveValues = Prisma.join(
                itemsWithStock.map(
                    (item) => Prisma.sql`(${item.variantId}, ${item.quantity}::int)`,
                ),
            );

            const reservedRows = await tx.$queryRaw<Array<{ variant_id: string }>>(
                Prisma.sql`
                    UPDATE "inventory" AS i
                    SET "stock" = i."stock" - req.qty,
                        "updated_at" = NOW()
                    FROM (VALUES ${reserveValues}) AS req(variant_id, qty)
                    WHERE i."variant_id" = req.variant_id
                      AND i."stock" >= req.qty
                    RETURNING i."variant_id" AS variant_id
                `,
            );

            if (reservedRows.length !== itemsWithStock.length) {
                const reserved = new Set(reservedRows.map((row) => row.variant_id));
                const failed = itemsWithStock.find((item) => !reserved.has(item.variantId));
                const variantId = failed?.variantId ?? 'unknown';

                recordReserveFailure(variantId);
                checkoutFailTotal.inc({ reason: 'out_of_stock' });
                inventoryLogger.warn({
                    event: 'inventory_reserve_failed',
                    userId,
                    variantId,
                    qty: failed?.quantity,
                }, `Reserve failed for variant ${variantId}`);
                throw new ApiError(
                    409,
                    `Insufficient stock for variant ${variantId}. Please refresh and try again.`,
                );
            }

            inventoryLogger.info({
                event: 'inventory_reserve_success',
                userId,
                variantIds: itemsWithStock.map((item) => item.variantId),
                items: itemsWithStock.length,
            }, `Reserved ${itemsWithStock.length} variant(s) in one statement`);

            const uniqueSellerIds = Array.from(new Set(itemsWithStock.map((item) => item.sellerId)));

            let appliedCoupon: {
                couponId: string;
                couponCode: string;
                discountAmount: Prisma.Decimal;
            } | null = null;

            if (couponCode && couponCode.trim().length > 0) {
                appliedCoupon = await couponService.applyCouponToOrder({
                    userId,
                    couponCode,
                    orderSubtotal,
                    sellerIds: uniqueSellerIds,
                    tx,
                });
            }

            const totalDiscount = appliedCoupon?.discountAmount ?? new Prisma.Decimal(0);

            let allocatedDiscount = new Prisma.Decimal(0);
            const discountedLines = itemsWithStock.map((item, index) => {
                const isLast = index === itemsWithStock.length - 1;

                let itemDiscount = new Prisma.Decimal(0);
                if (totalDiscount.gt(0)) {
                    if (isLast) {
                        itemDiscount = totalDiscount.sub(allocatedDiscount);
                    } else {
                        itemDiscount = round2(
                            totalDiscount.mul(item.lineSubtotal).div(orderSubtotal),
                        );
                        allocatedDiscount = allocatedDiscount.add(itemDiscount);
                    }

                    if (itemDiscount.gt(item.lineSubtotal)) {
                        itemDiscount = item.lineSubtotal;
                    }
                }

                const discountedTaxable = round2(item.lineSubtotal.sub(itemDiscount));
                const taxRate = new Prisma.Decimal(item.taxRate);
                const taxAmount = round2(discountedTaxable.mul(taxRate).div(100));

                const intraState =
                    !item.buyerState || item.sellerState.toLowerCase().trim() === item.buyerState.toLowerCase().trim();

                let cgst = new Prisma.Decimal(0);
                let sgst = new Prisma.Decimal(0);
                let igst = new Prisma.Decimal(0);

                if (taxAmount.gt(0)) {
                    if (intraState) {
                        cgst = round2(taxAmount.div(2));
                        sgst = round2(taxAmount.sub(cgst));
                    } else {
                        igst = taxAmount;
                    }
                }

                gstCalculationTotal.inc();
                if (igst.gt(0)) {
                    igstAppliedTotal.inc();
                } else if (cgst.gt(0) || sgst.gt(0)) {
                    intraStateOrderTotal.inc();
                }

                const lineTotal = round2(discountedTaxable.add(cgst).add(sgst).add(igst));

                return {
                    ...item,
                    discountedTaxable,
                    itemDiscount,
                    cgst,
                    sgst,
                    igst,
                    lineTotal,
                };
            });

            const totalQty = itemsWithStock.reduce((sum, item) => sum + item.quantity, 0);
            const flatGstFee = gstChargeEnabled
                ? new Prisma.Decimal(FLAT_GST_FEE_INR).mul(totalQty)
                : new Prisma.Decimal(0);
            const orderSubTotal = round2(
                discountedLines.reduce((sum, item) => sum.add(item.discountedTaxable), new Prisma.Decimal(0)),
            );
            const orderTaxTotal = round2(
                discountedLines.reduce((sum, item) => sum.add(item.cgst).add(item.sgst).add(item.igst), new Prisma.Decimal(0)),
            );
            const orderGrandTotal = round2(
                discountedLines.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0)),
            );
            const orderTaxTotalWithFlat = round2(orderTaxTotal.add(flatGstFee));
            const orderGrandTotalWithFlat = round2(orderGrandTotal.add(flatGstFee));
            const grandTotalWithShipping = round2(orderGrandTotalWithFlat.add(shippingFee));
            const totalAmount = grandTotalWithShipping;

            // 2b. Create order with items
            const created = await tx.order.create({
                data: {
                    userId,
                    totalAmount: Number(totalAmount.toString()),
                    subTotalAmount: Number(orderSubTotal.toString()),
                    totalTaxAmount: Number(orderTaxTotalWithFlat.toString()),
                    grandTotal: Number(grandTotalWithShipping.toString()),
                    couponCode: appliedCoupon?.couponCode ?? null,
                    discountAmount: totalDiscount,
                    shippingName: shipping?.shippingName ?? null,
                    shippingPhone: shipping?.shippingPhone ?? null,
                    shippingEmail: shipping?.shippingEmail ?? null,
                    shippingAddressLine1: shipping?.shippingAddressLine1 ?? null,
                    shippingAddressLine2: shipping?.shippingAddressLine2 ?? null,
                    shippingCity: shipping?.shippingCity ?? null,
                    shippingPincode: shipping?.shippingPincode ?? null,
                    shippingNotes: shipping?.shippingNotes ?? null,
                    status: 'PLACED',
                    // Items are inserted separately with createMany below. A nested
                    // `items: { create: [...] }` makes Prisma 4 issue one INSERT per
                    // item, serially inside the transaction — a three-item cart paid
                    // three round-trips where one will do.
                },
                // Deliberately no `include: { items: true }` — Prisma 4 satisfies an
                // include by re-SELECTing the row and its relation after the INSERT,
                // which cost two extra round-trips *inside* the transaction (where
                // every statement is strictly serial). Nothing needs the persisted
                // items: the response omits them, and the only consumer is the GST log
                // below, which is computed from `discountedLines` we already hold.
            });

            // All order items in ONE statement.
            await tx.orderItem.createMany({
                data: discountedLines.map((item) => ({
                    orderId: created.id,
                    sellerId: item.sellerId,
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    priceSnapshot: item.priceSnapshot,
                    sellerPriceSnapshot: item.sellerPriceSnapshot,
                    adminPriceSnapshot: item.adminPriceSnapshot,
                    platformMargin: item.platformMargin,
                    taxRate: item.taxRate,
                    taxableAmount: Number(item.discountedTaxable.toString()),
                    cgstAmount: Number(item.cgst.toString()),
                    sgstAmount: Number(item.sgst.toString()),
                    igstAmount: Number(item.igst.toString()),
                    totalAmount: Number(item.lineTotal.toString()),
                })),
            });

            if (appliedCoupon && totalDiscount.gt(0)) {
                await couponService.redeemCouponAfterOrderCreated({
                    tx,
                    couponId: appliedCoupon.couponId,
                    userId,
                    orderId: created.id,
                    discountAmount: totalDiscount,
                });
            }

            // 2c. Create RESERVE inventory movements (audit trail)
            await tx.inventoryMovement.createMany({
                data: itemsWithStock.map((item) => ({
                    variantId: item.variantId,
                    orderId: created.id,
                    quantity: item.quantity,
                    type: 'RESERVE',
                    reason: 'CHECKOUT',
                })),
            });

            // 2d. Clear the ordered rows. Raw DELETE on purpose: Prisma 4's
            //     deleteMany issued two SELECTs to collect ids and then deleted by
            //     id — three serial round-trips inside the transaction to do one
            //     thing. A buy-now checkout must leave the rest of the cart alone.
            if (selectedVariantIds) {
                await tx.$executeRaw`DELETE FROM "cart_items" WHERE "cart_id" = ${cartId} AND "variant_id" = ANY(${Array.from(selectedVariantIds)}::text[])`;
            } else {
                await tx.$executeRaw`DELETE FROM "cart_items" WHERE "cart_id" = ${cartId}`;
            }

            // Carry the intra-state flag out instead of re-reading order items later.
            const hasIntraState = discountedLines.some(
                (line) => line.cgst.gt(0) || line.sgst.gt(0),
            );

            return { ...created, hasIntraState };
        }, {
            maxWait: 20000,
            timeout: 20000,
        });

        // =====================================================================
        // PHASE 3 — Post-transaction side effects (best-effort)
        // =====================================================================

        // Invalidate caches
        const productIdsToInvalidate = Array.from(new Set(itemsWithStock.map((item) => item.productId)));

        // Keep buyer cart immediately consistent for UX; run broader invalidations asynchronously.
        await invalidateCache(CACHE_KEYS.CART(userId));

        void Promise.allSettled([
            invalidateCacheByPattern(`orders:buyer:${userId}:*`),
            invalidateCacheByPattern(`orders:detail:*`),
            invalidateCacheByPattern(`recommendations:${userId}`),
            ...productIdsToInvalidate.map((productId) =>
                invalidateCache(CACHE_KEYS.PRODUCT_DETAIL(productId))
            ),
            invalidateCache(CACHE_KEYS.PRODUCTS_LIST),
            invalidateCacheByPattern('products:list:*'),
            invalidateCacheByPattern('search:*'),
        ]).catch((error) => {
            checkoutLogger.warn({ userId, orderId: order.id, error }, 'Async cache invalidation failed');
        });

        // Trigger Notifications (event-driven, idempotent, best-effort)
        void emitOrderPlaced(order.id).catch((error) => {
            checkoutLogger.error({ orderId: order.id, error }, 'Failed to emit order placed event');
        });

        void dispatchFreshness({
            type: 'order.updated',
            entityId: order.id,
            tags: [
                CACHE_TAGS.orders,
                CACHE_TAGS.userOrders,
                CACHE_TAGS.sellerOrders,
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                orderTag(order.id),
                ...productIdsToInvalidate.map((productId) => productTag(productId)),
            ],
            audience: { allAuthenticated: true },
        }).catch((error) => {
            checkoutLogger.warn({ orderId: order.id, error }, 'checkout_freshness_dispatch_failed');
        });

        checkoutSuccessTotal.inc();
        checkoutLogger.info({
            event: 'checkout_success',
            userId,
            orderId: order.id,
            totalAmount: order.totalAmount,
            itemCount: itemsWithStock.length,
            couponCode: order.couponCode,
            discountAmount: order.discountAmount,
        }, `Checkout succeeded — order ${order.id}`);

        // Structured GST log
        const hasIntraState = order.hasIntraState;
        checkoutLogger.info({
            event: 'gst_calculated',
            orderId: order.id,
            intraState: hasIntraState,
            totalTax: order.totalTaxAmount,
            subTotal: order.subTotalAmount,
            grandTotal: order.grandTotal,
            discountAmount: order.discountAmount,
        }, `GST calculated for order ${order.id}`);

        return {
            message: 'Order placed successfully',
            order: {
                id: order.id,
                userId: order.userId,
                status: order.status,
                totalAmount: order.totalAmount,
                subTotalAmount: order.subTotalAmount,
                totalTaxAmount: order.totalTaxAmount,
                grandTotal: order.grandTotal,
                couponCode: order.couponCode,
                discountAmount: Number(order.discountAmount),
                createdAt: order.createdAt,
            },
        };
    }
}

// Export singleton instance
export const checkoutService = new CheckoutService(cartRepository);
