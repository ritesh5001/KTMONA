import { prisma } from '../config/db.js';
import { CartRepository, cartRepository, type CheckoutCartRow } from '../repositories/cart.repository.js';
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
import { couponService, listPublicCoupons } from './coupon.service.js';
import { offersConfigService } from './offers-config.service.js';
import { referralService } from './referral.service.js';
import { walletService } from './wallet.service.js';
import { settingsService, shippingFeeFor, platformFeeFor, COD_MAX_ORDER_INR } from './settings.service.js';
import { codEligibilityService } from './cod-eligibility.service.js';
import { generateInvoiceNumber } from '../utils/invoice.util.js';
import { sellerAdsService } from './seller-center/ads.service.js';
import { Prisma } from '@prisma/client';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, orderTag, productTag } from '../live/cache-tags.js';

const round2 = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const MAX_CHECKOUT_ITEMS = 20;

/** One cart line validated and priced for checkout (internal: carries seller cost). */
export interface CheckoutLine {
    itemId: string;
    variantId: string;
    productId: string;
    categoryId: string | null;
    sellerId: string;
    title: string;
    image: string | null;
    size: string | null;
    color: string | null;
    quantity: number;
    stock: number;
    /** Price the buyer pays per unit (before coupon and tax). */
    priceSnapshot: number;
    /** Struck-through MRP per unit, when higher than the price. */
    compareAtPrice: number | null;
    sellerPriceSnapshot: number;
    adminPriceSnapshot: number;
    platformMargin: number;
    taxRate: number;
    sellerState: string;
    buyerState: string;
    lineSubtotal: Prisma.Decimal;
}

/** Why a cart line cannot be checked out right now. */
export interface CheckoutLineIssue {
    itemId: string;
    variantId: string;
    title: string;
    kind: 'NOT_FOUND' | 'UNAVAILABLE' | 'PENDING_APPROVAL' | 'PRICING' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';
    message: string;
    /** For stock problems: how many can still be bought. */
    available?: number;
}

/** A discount applied without a code (welcome offer, referral bonus). */
export interface AutoDiscount {
    key: 'WELCOME' | 'REFERRAL';
    label: string;
    amount: number;
}

/** True until the customer has an order that was not cancelled. */
async function isFirstOrder(userId: string): Promise<boolean> {
    return (await prisma.order.count({ where: { userId, status: { not: 'CANCELLED' } } })) === 0;
}

/** Welcome offer and referral bonus for a customer's first order. */
export async function computeAutoDiscounts(userId: string, itemsTotal: number): Promise<AutoDiscount[]> {
    const config = await offersConfigService.get();
    if (!(config.welcome.enabled || config.referral.enabled) || itemsTotal <= 0) return [];
    if (!(await isFirstOrder(userId))) return [];
    const out: AutoDiscount[] = [];
    if (config.welcome.enabled && config.welcome.amount > 0 && itemsTotal >= config.welcome.minOrder) {
        out.push({ key: 'WELCOME', label: 'Welcome offer', amount: config.welcome.amount });
    }
    if (config.referral.enabled && config.referral.friendAmount > 0 && itemsTotal >= config.referral.minOrder) {
        if (await referralService.pendingFor(userId)) {
            out.push({ key: 'REFERRAL', label: 'Referral bonus', amount: config.referral.friendAmount });
        }
    }
    return out;
}

/** Best eligible auto-apply coupon for these lines, when the shopper typed no code. */
async function pickAutoCoupon(
    userId: string,
    items: CheckoutLine[],
    orderSubtotal: Prisma.Decimal,
): Promise<{ code: string; discount: number } | null> {
    const candidates = (await listPublicCoupons()).filter((c) => c.autoApply).slice(0, 15);
    let best: { code: string; discount: number } | null = null;
    for (const c of candidates) {
        try {
            const applied = await couponService.applyCouponToOrder({
                userId,
                couponCode: c.code,
                orderSubtotal,
                sellerIds: Array.from(new Set(items.map((i) => i.sellerId))),
                lines: items.map((i) => ({ productId: i.productId, categoryId: i.categoryId, amount: i.lineSubtotal })),
                preview: true,
            });
            const discount = Number(applied.discountAmount.toString());
            if (!best || discount > best.discount) best = { code: applied.couponCode, discount };
        } catch {
            // Not eligible for this cart.
        }
    }
    return best;
}

/** Price breakup returned by POST /v1/checkout/quote (buyer-safe: no seller costs). */
export interface CheckoutQuote {
    lines: Array<{
        itemId: string;
        variantId: string;
        productId: string;
        title: string;
        image: string | null;
        size: string | null;
        color: string | null;
        quantity: number;
        stock: number;
        unitPrice: number;
        /** MRP per unit when it is above the price. */
        unitMrp: number | null;
        /** unitPrice × quantity, before coupon and tax. */
        lineTotal: number;
        taxRate: number;
    }>;
    /** Lines left out because they cannot be ordered right now. */
    issues: CheckoutLineIssue[];
    /** Units across all lines. */
    itemCount: number;
    mrpTotal: number;
    /** MRP minus selling price. */
    productDiscount: number;
    /** Selling price total, before coupon. */
    itemsTotal: number;
    /** Applied coupon; `auto` = picked automatically (no code typed). */
    coupon: { code: string; discount: number; auto: boolean } | null;
    couponError: string | null;
    /** Welcome offer / referral bonus on a first order. */
    autoDiscounts: AutoDiscount[];
    /** Items total after the coupon (GST is charged on this). */
    taxableAmount: number;
    /** Product GST. */
    gst: number;
    /** Platform fee (same as `platformFee`; kept for older app builds). */
    gstFee: number;
    /** KTMONA platform fee, per item or per order as the admin set it. */
    platformFee: number;
    platformFeeMode: 'PER_ITEM' | 'PER_ORDER';
    /** Delivery charge for this order (0 when free). */
    shipping: number;
    /** The normal delivery charge (0 = delivery is always free). */
    shippingFee: number;
    freeDelivery: { threshold: number; eligible: boolean; remaining: number } | null;
    /** Cashback wallet: balance, how much this order may use, and what is applied. */
    wallet: { available: number; usable: number; applied: number };
    /** What the buyer pays. */
    total: number;
    /** MRP discount + coupon + waived delivery. */
    savings: number;
    cod: { available: boolean; reason: string | null; maxOrderAmount: number };
    /** Every line is orderable (and there is at least one). */
    canPlaceOrder: boolean;
}

/** Validate cart rows (availability, approval, pricing, stock) and price each line. */
export function buildCheckoutLines(
    rows: CheckoutCartRow[],
    buyerState: string,
): { items: CheckoutLine[]; errors: CheckoutLineIssue[] } {
    const items: CheckoutLine[] = [];
    const errors: CheckoutLineIssue[] = [];

    for (const row of rows) {
        const title = row.productTitle ?? 'this item';
        const issue = (kind: CheckoutLineIssue['kind'], message: string, available?: number) =>
            errors.push({ itemId: row.itemId, variantId: row.variantId, title, kind, message, ...(available !== undefined ? { available } : {}) });

        if (row.sellerId == null || row.variantStatus == null || row.variantPrice == null) {
            issue('NOT_FOUND', `Product or variant not found for item ${row.itemId}`);
            continue;
        }
        if (row.productDeleted || row.productPaused || row.productStatus !== 'APPROVED') {
            issue('UNAVAILABLE', `${title} is no longer available for purchase`);
            continue;
        }
        if (row.variantStatus !== 'APPROVED') {
            issue('PENDING_APPROVAL', `Selected variant is pending approval for ${title}`);
            continue;
        }

        const price = Number(row.variantPrice);
        const sellerPrice = Number(row.variantSellerPrice ?? 0);
        const margin = price - sellerPrice;
        if (margin < 0) {
            issue('PRICING', `Invalid pricing state for ${title}`);
            continue;
        }

        if (row.stock <= 0) {
            issue('OUT_OF_STOCK', `${title} is out of stock`, 0);
            continue;
        }
        if (row.quantity > row.stock) {
            issue('INSUFFICIENT_STOCK', `Insufficient stock for ${title}: Available ${row.stock}, Requested ${row.quantity}`, row.stock);
            continue;
        }

        const compareAt = row.variantCompareAtPrice == null ? null : Number(row.variantCompareAtPrice);
        items.push({
            itemId: row.itemId,
            variantId: row.variantId,
            productId: row.productId,
            categoryId: row.categoryId,
            sellerId: row.sellerId,
            title,
            image: row.variantImage ?? row.productImage ?? null,
            size: row.variantSize,
            color: row.variantColor,
            quantity: row.quantity,
            stock: row.stock,
            priceSnapshot: price,
            compareAtPrice: compareAt != null && compareAt > price ? compareAt : null,
            sellerPriceSnapshot: sellerPrice,
            adminPriceSnapshot: price,
            platformMargin: margin,
            taxRate: row.taxRate ?? 0,
            sellerState: row.sellerState,
            buyerState,
            lineSubtotal: new Prisma.Decimal(price).mul(row.quantity),
        });
    }

    return { items, errors };
}

/**
 * Spread a coupon discount across lines in proportion to their value, then add
 * GST per line (CGST+SGST within the seller's state, IGST across states).
 */
export function priceCheckoutLines(items: CheckoutLine[], totalDiscount: Prisma.Decimal) {
    const orderSubtotal = items.reduce((sum, item) => sum.add(item.lineSubtotal), new Prisma.Decimal(0));

    let allocatedDiscount = new Prisma.Decimal(0);
    const discountedLines = items.map((item, index) => {
        const isLast = index === items.length - 1;

        let itemDiscount = new Prisma.Decimal(0);
        if (totalDiscount.gt(0)) {
            if (isLast) {
                itemDiscount = totalDiscount.sub(allocatedDiscount);
            } else {
                itemDiscount = round2(totalDiscount.mul(item.lineSubtotal).div(orderSubtotal));
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

    const orderSubTotal = round2(
        discountedLines.reduce((sum, item) => sum.add(item.discountedTaxable), new Prisma.Decimal(0)),
    );
    const orderTaxTotal = round2(
        discountedLines.reduce((sum, item) => sum.add(item.cgst).add(item.sgst).add(item.igst), new Prisma.Decimal(0)),
    );
    const orderGrandTotal = round2(
        discountedLines.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0)),
    );

    return { discountedLines, orderSubTotal, orderTaxTotal, orderGrandTotal };
}

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
        /**
         * COD: the order is confirmed straight away with a payment that stays
         * INITIATED until the courier collects the cash on delivery. ONLINE
         * (default): the order waits as PLACED for the Razorpay payment.
         */
        paymentMethod: 'ONLINE' | 'COD' = 'ONLINE',
        /**
         * Client-generated key for this Place Order attempt. A repeat with the same
         * key (double click, network retry, Back + resubmit) returns the order it
         * already created instead of placing a second one.
         */
        checkoutKey?: string,
        /** Pay part of the order from the cashback wallet (up to the admin's limit). */
        options: { useWallet?: boolean } = {},
    ): Promise<CheckoutResponse> {
        if (checkoutKey) {
            const existing = await this.findByCheckoutKey(userId, checkoutKey);
            if (existing) return existing;
        }

        try {
            return await this.placeOrder(userId, shipping, couponCode, variantIds, paymentMethod, checkoutKey, options);
        } catch (error) {
            // Two submits with the same key raced: the loser's transaction hit the
            // unique key and rolled back (stock, coupon and all). Hand back the winner.
            if (checkoutKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const existing = await this.findByCheckoutKey(userId, checkoutKey);
                if (existing) return existing;
            }
            throw error;
        }
    }

    /**
     * Price the cart (or a buy-now selection) exactly as checkout would, without
     * reserving stock or redeeming the coupon. Lines that cannot be ordered are
     * reported in `issues` and left out of the totals instead of failing.
     */
    async quote(
        userId: string,
        input: { variantIds?: string[]; couponCode?: string; paymentMethod?: 'ONLINE' | 'COD'; useWallet?: boolean },
    ): Promise<CheckoutQuote> {
        const [cartRows, buyer, shippingRules, platformFeeRules] = await Promise.all([
            this.cartRepo.getCartForCheckout(userId),
            prisma.user.findUnique({ where: { id: userId }, select: { state: true } }),
            settingsService.getShippingRules(),
            settingsService.getPlatformFeeRules(),
        ]);

        const selected = input.variantIds?.length
            ? cartRows.filter((row) => input.variantIds!.includes(row.variantId))
            : cartRows;
        const { items, errors } = buildCheckoutLines(selected, buyer?.state ?? '');

        const itemsTotal = items.reduce((sum, item) => sum.add(item.lineSubtotal), new Prisma.Decimal(0));

        let coupon: CheckoutQuote['coupon'] = null;
        let couponError: string | null = null;
        if (input.couponCode?.trim() && items.length > 0) {
            try {
                const applied = await couponService.applyCouponToOrder({
                    userId,
                    couponCode: input.couponCode,
                    orderSubtotal: itemsTotal,
                    sellerIds: Array.from(new Set(items.map((item) => item.sellerId))),
                    lines: items.map((i) => ({ productId: i.productId, categoryId: i.categoryId, amount: i.lineSubtotal })),
                    preview: true,
                });
                coupon = { code: applied.couponCode, discount: Number(applied.discountAmount.toString()), auto: false };
            } catch (error) {
                couponError = error instanceof Error ? error.message : 'This coupon cannot be applied';
            }
        } else if (items.length > 0) {
            const best = await pickAutoCoupon(userId, items, itemsTotal);
            if (best) coupon = { ...best, auto: true };
        }

        const autoDiscounts = items.length > 0 ? await computeAutoDiscounts(userId, Number(itemsTotal.toString())) : [];
        let totalDiscount = new Prisma.Decimal(coupon?.discount ?? 0).add(autoDiscounts.reduce((s, d) => s + d.amount, 0));
        if (totalDiscount.gt(itemsTotal)) totalDiscount = itemsTotal;

        const { orderSubTotal, orderTaxTotal, orderGrandTotal } = priceCheckoutLines(items, totalDiscount);
        const units = items.reduce((sum, item) => sum + item.quantity, 0);
        const gstFee = platformFeeFor(units, platformFeeRules);
        const taxable = Number(orderSubTotal.toString());
        const shipping = items.length > 0 ? shippingFeeFor(taxable, shippingRules) : 0;
        const grandTotal = Number(round2(orderGrandTotal.add(gstFee).add(shipping)).toString());
        const wallet = items.length > 0
            ? await walletService.usableFor(userId, grandTotal)
            : { available: 0, usable: 0 };
        const walletApplied = input.useWallet ? wallet.usable : 0;
        const total = Math.round((grandTotal - walletApplied) * 100) / 100;

        const mrpTotal = items.reduce(
            (sum, item) => sum + (item.compareAtPrice ?? item.priceSnapshot) * item.quantity,
            0,
        );
        const itemsTotalNum = Number(itemsTotal.toString());
        const productDiscount = Math.max(0, Math.round((mrpTotal - itemsTotalNum) * 100) / 100);
        const shippingWaived = items.length > 0 && shippingRules.fee > 0 && shipping === 0 ? shippingRules.fee : 0;

        const codCheck = items.length > 0
            ? await codEligibilityService.check(userId, selected)
            : { available: false, reason: null, blocked: false };
        const codTooBig = total > COD_MAX_ORDER_INR;

        return {
            lines: items.map((item) => ({
                itemId: item.itemId,
                variantId: item.variantId,
                productId: item.productId,
                title: item.title,
                image: item.image,
                size: item.size,
                color: item.color,
                quantity: item.quantity,
                stock: item.stock,
                unitPrice: item.priceSnapshot,
                unitMrp: item.compareAtPrice,
                lineTotal: Number(item.lineSubtotal.toString()),
                taxRate: item.taxRate,
            })),
            issues: errors,
            itemCount: units,
            mrpTotal: Math.round(mrpTotal * 100) / 100,
            productDiscount,
            itemsTotal: itemsTotalNum,
            coupon,
            couponError,
            autoDiscounts,
            taxableAmount: taxable,
            gst: Number(orderTaxTotal.toString()),
            gstFee,
            platformFee: gstFee,
            platformFeeMode: platformFeeRules.mode,
            shipping,
            shippingFee: shippingRules.fee,
            freeDelivery: shippingRules.fee > 0 && shippingRules.freeAbove > 0
                ? {
                    threshold: shippingRules.freeAbove,
                    eligible: taxable >= shippingRules.freeAbove,
                    remaining: Math.max(0, Math.round((shippingRules.freeAbove - taxable) * 100) / 100),
                }
                : null,
            wallet: { available: wallet.available, usable: wallet.usable, applied: walletApplied },
            total,
            savings: Math.round((productDiscount + Number(totalDiscount.toString()) + shippingWaived + walletApplied) * 100) / 100,
            cod: {
                available: codCheck.available && !codTooBig,
                reason: codTooBig
                    ? `Cash on Delivery is available for orders up to ₹${COD_MAX_ORDER_INR.toLocaleString('en-IN')}`
                    : codCheck.reason,
                maxOrderAmount: COD_MAX_ORDER_INR,
            },
            canPlaceOrder: items.length > 0 && errors.length === 0,
        };
    }

    /** The order a checkout key already placed, shaped like a checkout response. */
    private async findByCheckoutKey(userId: string, checkoutKey: string): Promise<CheckoutResponse | null> {
        const order = await prisma.order.findUnique({
            where: { checkoutKey },
            include: { payment: { select: { provider: true } } },
        });
        if (!order) return null;
        if (order.userId !== userId) {
            throw ApiError.conflict('This checkout was already used. Please refresh and try again.');
        }
        checkoutLogger.info({ event: 'checkout_duplicate_submit', userId, orderId: order.id }, 'Repeat checkout returned existing order');
        return {
            message: 'Order already placed',
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
            paymentMethod: order.payment?.provider === 'COD' ? 'COD' : 'ONLINE',
            duplicate: true,
        };
    }

    private async placeOrder(
        userId: string,
        shipping: Parameters<CheckoutService['checkout']>[1],
        couponCode: string | undefined,
        variantIds: string[] | undefined,
        paymentMethod: 'ONLINE' | 'COD',
        checkoutKey: string | undefined,
        options: { useWallet?: boolean },
    ): Promise<CheckoutResponse> {
        // =====================================================================
        // PHASE 1 — Read-only validation (outside transaction)
        // =====================================================================

        // One batched load (2 queries) covers the cart, its products, each product's
        // taxRate, the seller's state and the exact variants with pricing + stock.
        // The buyer's state and the two app settings are independent of all of it, so
        // they ride along in the same round-trip instead of being awaited in series.
        const [cartRows, buyer, shippingRules, platformFeeRules] = await Promise.all([
            this.cartRepo.getCartForCheckout(userId),
            prisma.user.findUnique({
                where: { id: userId },
                select: { state: true },
            }),
            settingsService.getShippingRules(),
            settingsService.getPlatformFeeRules(),
        ]);
        if (cartRows.length === 0) {
            throw ApiError.badRequest('Cart is empty');
        }
        if (paymentMethod === 'COD' && !(await settingsService.isCodEnabled())) {
            throw ApiError.badRequest('Cash on Delivery is not available right now. Please pay online.');
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

        // COD switched off by an admin for this customer, a seller or a product.
        if (paymentMethod === 'COD') {
            const blocked = await codEligibilityService.blockReason(userId, selectedRows);
            if (blocked) throw ApiError.badRequest(blocked);
        }

        const { items: itemsWithStock, errors } = buildCheckoutLines(selectedRows, buyer?.state ?? '');
        if (errors.length > 0) {
            throw ApiError.badRequest(errors.map((e) => e.message).join('; '));
        }

        // Calculate pre-tax subtotal only. GST is calculated after coupon discount allocation.
        const orderSubtotal = itemsWithStock.reduce(
            (sum, item) => sum.add(item.lineSubtotal),
            new Prisma.Decimal(0),
        );
        // Automatic discounts and the best auto-apply coupon are read-only lookups,
        // so they are resolved here rather than inside the transaction.
        const autoDiscounts = await computeAutoDiscounts(userId, Number(orderSubtotal.toString()));
        const autoCoupon = couponCode?.trim() ? null : await pickAutoCoupon(userId, itemsWithStock, orderSubtotal);
        const effectiveCouponCode = couponCode?.trim() ? couponCode : autoCoupon?.code;

        // shippingRules and platformFeeRules were resolved in the batched load above —
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

            if (effectiveCouponCode && effectiveCouponCode.trim().length > 0) {
                try {
                    appliedCoupon = await couponService.applyCouponToOrder({
                        userId,
                        couponCode: effectiveCouponCode,
                        orderSubtotal,
                        sellerIds: uniqueSellerIds,
                        lines: itemsWithStock.map((i) => ({ productId: i.productId, categoryId: i.categoryId, amount: i.lineSubtotal })),
                        tx,
                    });
                } catch (error) {
                    // A coupon the shopper typed must work or fail loudly; an
                    // automatic one that just ran out is simply skipped.
                    if (couponCode?.trim()) throw error;
                    appliedCoupon = null;
                }
            }

            const couponDiscount = appliedCoupon?.discountAmount ?? new Prisma.Decimal(0);
            const autoDiscountTotal = autoDiscounts.reduce((sum, d) => sum + d.amount, 0);
            // Coupon + automatic discounts, never more than the items are worth.
            let totalDiscount = couponDiscount.add(autoDiscountTotal);
            if (totalDiscount.gt(orderSubtotal)) totalDiscount = orderSubtotal;
            const autoDiscountApplied = Number(totalDiscount.sub(couponDiscount).toString());

            const { discountedLines, orderSubTotal, orderTaxTotal, orderGrandTotal } =
                priceCheckoutLines(itemsWithStock, totalDiscount);
            for (const line of discountedLines) {
                gstCalculationTotal.inc();
                if (line.igst.gt(0)) {
                    igstAppliedTotal.inc();
                } else if (line.cgst.gt(0) || line.sgst.gt(0)) {
                    intraStateOrderTotal.inc();
                }
            }
            const totalQty = itemsWithStock.reduce((sum, item) => sum + item.quantity, 0);
            // Platform fee (per item or per order, as the admin set it).
            const flatGstFee = new Prisma.Decimal(platformFeeFor(totalQty, platformFeeRules));
            // Free delivery is judged on the subtotal after the coupon.
            const shippingFee = shippingFeeFor(Number(orderSubTotal.toString()), shippingRules);
            const orderTaxTotalWithFlat = round2(orderTaxTotal.add(flatGstFee));
            const orderGrandTotalWithFlat = round2(orderGrandTotal.add(flatGstFee));
            const grandTotalWithShipping = round2(orderGrandTotalWithFlat.add(shippingFee));
            // Cashback wallet pays part of the order; the rest is what the buyer pays now.
            const walletUse = options.useWallet
                ? (await walletService.usableFor(userId, Number(grandTotalWithShipping.toString()))).usable
                : 0;
            const totalAmount = round2(grandTotalWithShipping.sub(walletUse));
            // Throwing here rolls back the stock reservation and coupon with it.
            if (paymentMethod === 'COD' && totalAmount.gt(COD_MAX_ORDER_INR)) {
                throw ApiError.badRequest(
                    `Cash on Delivery is available for orders up to ₹${COD_MAX_ORDER_INR.toLocaleString('en-IN')}. Please pay online.`,
                );
            }
            const isCod = paymentMethod === 'COD';

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
                    walletAmount: walletUse,
                    platformFeeAmount: Number(flatGstFee.toString()),
                    autoDiscountAmount: autoDiscountApplied,
                    autoDiscountLabel: autoDiscountApplied > 0 ? autoDiscounts.map((d) => d.label).join(' + ') : null,
                    shippingName: shipping?.shippingName ?? null,
                    shippingPhone: shipping?.shippingPhone ?? null,
                    shippingEmail: shipping?.shippingEmail ?? null,
                    shippingAddressLine1: shipping?.shippingAddressLine1 ?? null,
                    shippingAddressLine2: shipping?.shippingAddressLine2 ?? null,
                    shippingCity: shipping?.shippingCity ?? null,
                    shippingPincode: shipping?.shippingPincode ?? null,
                    shippingNotes: shipping?.shippingNotes ?? null,
                    checkoutKey: checkoutKey ?? null,
                    // COD needs no payment step: the order is confirmed (and
                    // invoiced) at once; cash is collected on delivery.
                    status: isCod ? 'CONFIRMED' : 'PLACED',
                    ...(isCod
                        ? { invoiceNumber: await generateInvoiceNumber(tx as any), invoiceIssuedAt: new Date() }
                        : {}),
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

            if (appliedCoupon && couponDiscount.gt(0)) {
                await couponService.redeemCouponAfterOrderCreated({
                    tx,
                    couponId: appliedCoupon.couponId,
                    userId,
                    orderId: created.id,
                    discountAmount: couponDiscount,
                });
            }

            if (walletUse > 0) {
                await walletService.debitInTx(tx, userId, walletUse, created.id);
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
                // Saved-for-later lines stay behind.
                await tx.$executeRaw`DELETE FROM "cart_items" WHERE "cart_id" = ${cartId} AND "saved_for_later" = false`;
            }

            if (isCod) {
                // INITIATED until delivery: marking it SUCCESS now would tell the
                // settlement ledger money had arrived that nobody has collected.
                const payment = await tx.payment.create({
                    data: {
                        orderId: created.id,
                        userId,
                        amount: Number(totalAmount.toString()),
                        provider: 'COD',
                        status: 'INITIATED',
                    },
                });
                await tx.paymentEvent.create({
                    data: { paymentId: payment.id, type: 'INITIATED', payload: { method: 'COD' } },
                });
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

        // A referred customer's first order: the referrer is rewarded once it is delivered.
        void referralService.markFirstOrder(userId, order.id).catch(() => undefined);

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

        if (paymentMethod === 'COD') {
            // Credit any ad click that led to this sale. The seller settlement is
            // booked when the cash is collected on delivery (shipment service).
            void sellerAdsService.attributeOrder(order.id).catch(() => undefined);
        }

        // Order confirmation (buyer email + seller new-order alerts). Only COD is
        // confirmed at this point; an online order is still unpaid, so its
        // confirmation goes out from paymentService.handlePaymentSuccess.
        if (paymentMethod === 'COD') {
            void emitOrderPlaced(order.id).catch((error) => {
                checkoutLogger.error({ orderId: order.id, error }, 'Failed to emit order placed event');
            });
        }

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
            paymentMethod,
        };
    }
}

// Export singleton instance
export const checkoutService = new CheckoutService(cartRepository);
