/**
 * Turning a completed Shiprocket Checkout (Fastrr) checkout into a Tatvivah order.
 *
 * Three independent triggers call in here — the order webhook, the callback page
 * polling after the buyer is redirected back, and the reconciliation sweep — and
 * Fastrr's own docs warn that webhooks may be delivered more than once. So the
 * single most important property of this file is that running it twice for the
 * same checkout produces exactly one order. That is enforced in two layers:
 *
 *   1. `SELECT ... FOR UPDATE` on the session row serialises concurrent callers,
 *      so two of them cannot both pass the "already materialised?" check.
 *   2. `fastrr_checkout_sessions.order_id` is UNIQUE, so even if layer 1 were
 *      somehow bypassed the second insert fails rather than double-charging
 *      inventory.
 *
 * Nothing here trusts the webhook body. Whatever arrives, the order is built
 * from a fresh Order/Details call against Fastrr — that payload decides what the
 * buyer bought and what they paid, because it is the only version of those facts
 * that an attacker POSTing to our webhook URL cannot forge.
 *
 * GST: our catalog is published to Fastrr at the buyer-facing price, and Fastrr
 * charges exactly that — it never adds tax on top the way the native checkout
 * does. So tax is extracted *out of* the amount collected rather than added to
 * it. Same rupees to the buyer, correct split for the invoice and settlements.
 */
import { Prisma, FastrrSessionStatus, PaymentProvider, PaymentStatus, PaymentEventType, OrderStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { checkoutLogger, paymentLogger } from '../config/logger.js';
import { generateInvoiceNumber } from '../utils/invoice.util.js';
import { paymentService } from './payment.service.js';
import { commissionService } from './commission.service.js';
import { couponService } from './coupon.service.js';
import { emitOrderPlaced } from '../events/order.events.js';
import { getFastrrOrderDetails, isFastrrConfigured, } from './fastrr.client.js';
import { invalidateCache, invalidateCacheByPattern, CACHE_KEYS, } from '../utils/cache.util.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, orderTag, productTag } from '../live/cache-tags.js';
const round2 = (value) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const TX_MAX_WAIT_MS = 20000;
const TX_TIMEOUT_MS = 30000;
/** Don't poll a session younger than this — it would just race the webhook. */
const SWEEP_MIN_AGE_MS = 10 * 60 * 1000;
/** Past this, a session that never completed is treated as abandoned. */
const SWEEP_GIVE_UP_MS = 24 * 60 * 60 * 1000;
/** Each Fastrr lookup is a network round-trip; keep one sweep bounded. */
const SWEEP_BATCH_SIZE = 50;
export class FastrrOrderService {
    /**
     * Bring our database in line with Fastrr's view of one checkout.
     *
     * Safe to call repeatedly and from anywhere; it is a no-op once the order
     * exists, and never throws for the ordinary "buyer has not finished yet"
     * case — a webhook handler that threw on that would make Fastrr retry
     * forever.
     */
    async syncFromFastrr(fastrrOrderId, source) {
        const session = await prisma.fastrrCheckoutSession.findUnique({
            where: { fastrrOrderId },
        });
        if (!session) {
            // Routine, not an error: the same Fastrr merchant account can be used
            // for direct API tests and by other channels. Acknowledge and move on
            // rather than making Fastrr retry a payload we can never place.
            checkoutLogger.warn({ event: 'fastrr_session_not_found', fastrrOrderId, source }, `Fastrr order ${fastrrOrderId} has no checkout session here — skipping`);
            return {
                orderId: null,
                status: 'UNKNOWN_SESSION',
                message: 'No matching checkout session',
            };
        }
        if (session.orderId) {
            return {
                orderId: session.orderId,
                status: 'COMPLETED',
                message: 'Order already placed',
            };
        }
        // The webhook body is untrusted input. This call is the source of truth.
        const details = await getFastrrOrderDetails(fastrrOrderId);
        await prisma.fastrrCheckoutSession.update({
            where: { id: session.id },
            data: { lastPolledAt: new Date() },
        });
        if (details.status === 'FAILED') {
            await this.markFailed(session.id, 'Fastrr reported the order as FAILED');
            return { orderId: null, status: 'FAILED', message: 'Payment failed' };
        }
        if (details.status !== 'SUCCESS') {
            // CREATED / INITIATED — the buyer is still in the overlay.
            return {
                orderId: null,
                status: 'PENDING',
                message: 'Checkout is still in progress',
            };
        }
        // A prepaid order that Fastrr has not actually collected on is not an
        // order. COD is the exception: nothing is collected until delivery, and
        // Fastrr marking it SUCCESS is the commitment.
        const isCod = details.payment_type === 'CASH_ON_DELIVERY';
        if (!isCod && details.payment_status !== 'Success') {
            checkoutLogger.warn({
                event: 'fastrr_success_without_payment',
                fastrrOrderId,
                paymentStatus: details.payment_status,
            }, `Fastrr order ${fastrrOrderId} is SUCCESS but payment is ${details.payment_status}`);
            return {
                orderId: null,
                status: 'PENDING',
                message: 'Awaiting payment confirmation',
            };
        }
        return this.materialize(session.id, fastrrOrderId, details, source, isCod);
    }
    /**
     * The failsafe Fastrr's own documentation asks for.
     *
     * Webhooks get lost, and a buyer who closes the tab before the redirect never
     * triggers the callback poll either. Left alone, that is a paid order that
     * never exists here — the single worst outcome in this integration. So every
     * INITIATED session that is old enough to have resolved one way or the other
     * is asked about directly.
     *
     * Sessions past the give-up window are marked EXPIRED so the sweep does not
     * grow unboundedly; abandoned overlays are by far the common case and cost
     * nothing, since no stock was held for them.
     */
    async reconcilePendingSessions() {
        if (!isFastrrConfigured()) {
            return { checked: 0, placed: 0, expired: 0 };
        }
        const now = Date.now();
        // Old enough that the buyer has either paid or gone. Polling sooner would
        // race the webhook for no benefit.
        const settleCutoff = new Date(now - SWEEP_MIN_AGE_MS);
        const giveUpCutoff = new Date(now - SWEEP_GIVE_UP_MS);
        const expired = await prisma.fastrrCheckoutSession.updateMany({
            where: {
                status: FastrrSessionStatus.INITIATED,
                createdAt: { lt: giveUpCutoff },
            },
            data: {
                status: FastrrSessionStatus.EXPIRED,
                failureReason: 'Checkout was not completed',
            },
        });
        const pending = await prisma.fastrrCheckoutSession.findMany({
            where: {
                status: FastrrSessionStatus.INITIATED,
                orderId: null,
                createdAt: { lt: settleCutoff, gte: giveUpCutoff },
            },
            orderBy: { createdAt: 'asc' },
            take: SWEEP_BATCH_SIZE,
            select: { fastrrOrderId: true },
        });
        let placed = 0;
        for (const session of pending) {
            try {
                const result = await this.syncFromFastrr(session.fastrrOrderId, 'sweep');
                if (result.status === 'COMPLETED')
                    placed += 1;
            }
            catch (error) {
                // One unreachable order must not stop the rest of the batch — the
                // next sweep will pick it up again.
                checkoutLogger.error({ event: 'fastrr_sweep_error', fastrrOrderId: session.fastrrOrderId, error }, `Fastrr reconciliation failed for ${session.fastrrOrderId}`);
            }
        }
        if (placed > 0 || expired.count > 0) {
            checkoutLogger.info({
                event: 'fastrr_reconcile_complete',
                checked: pending.length,
                placed,
                expired: expired.count,
            }, `Fastrr reconciliation placed ${placed} order(s)`);
        }
        return { checked: pending.length, placed, expired: expired.count };
    }
    // ------------------------------------------------------------------
    // Order creation
    // ------------------------------------------------------------------
    async materialize(sessionId, fastrrOrderId, details, source, isCod) {
        const fastrrItems = details.cart_data?.items ?? [];
        if (fastrrItems.length === 0) {
            await this.markFailed(sessionId, 'Fastrr reported a successful order with no items');
            return { orderId: null, status: 'FAILED', message: 'Order contained no items' };
        }
        const buyerState = details.shipping_address?.state?.trim() ?? '';
        const lines = await this.resolveLines(fastrrItems);
        // Money comes from Fastrr, not from our own arithmetic. The buyer has
        // already been charged `total_amount_payable`; recomputing a total here
        // would only create a number that disagrees with their card statement.
        const grossSubtotal = lines.reduce((sum, line) => sum.add(new Prisma.Decimal(line.unitPrice).mul(line.quantity)), new Prisma.Decimal(0));
        const totalDiscount = round2(new Prisma.Decimal(details.total_discount ?? 0));
        const grandTotal = round2(new Prisma.Decimal(details.total_amount_payable ?? 0));
        // Discount is spread across lines in proportion to their value, with the
        // remainder landing on the last line so the parts always re-sum to the
        // whole — the same allocation the native checkout uses.
        let allocated = new Prisma.Decimal(0);
        const priced = lines.map((line, index) => {
            const lineGross = new Prisma.Decimal(line.unitPrice).mul(line.quantity);
            let lineDiscount = new Prisma.Decimal(0);
            if (totalDiscount.gt(0) && grossSubtotal.gt(0)) {
                lineDiscount =
                    index === lines.length - 1
                        ? totalDiscount.sub(allocated)
                        : round2(totalDiscount.mul(lineGross).div(grossSubtotal));
                if (lineDiscount.gt(lineGross))
                    lineDiscount = lineGross;
                if (lineDiscount.lt(0))
                    lineDiscount = new Prisma.Decimal(0);
                allocated = allocated.add(lineDiscount);
            }
            // Tax-inclusive extraction: the buyer paid `netGross`, of which
            // netGross * rate/(100+rate) is GST.
            const netGross = round2(lineGross.sub(lineDiscount));
            const rate = new Prisma.Decimal(line.taxRate);
            const taxAmount = rate.gt(0)
                ? round2(netGross.mul(rate).div(rate.add(100)))
                : new Prisma.Decimal(0);
            const taxable = round2(netGross.sub(taxAmount));
            // Place of supply decides the split. An unknown buyer state is treated
            // as intra-state, matching the native checkout rather than inventing
            // an IGST liability from missing data.
            const intraState = !buyerState ||
                line.sellerState.toLowerCase().trim() === buyerState.toLowerCase().trim();
            let cgst = new Prisma.Decimal(0);
            let sgst = new Prisma.Decimal(0);
            let igst = new Prisma.Decimal(0);
            if (taxAmount.gt(0)) {
                if (intraState) {
                    cgst = round2(taxAmount.div(2));
                    sgst = round2(taxAmount.sub(cgst));
                }
                else {
                    igst = taxAmount;
                }
            }
            return { ...line, lineDiscount, netGross, taxable, cgst, sgst, igst };
        });
        const subTotalAmount = round2(priced.reduce((sum, line) => sum.add(line.taxable), new Prisma.Decimal(0)));
        const totalTaxAmount = round2(priced.reduce((sum, line) => sum.add(line.cgst).add(line.sgst).add(line.igst), new Prisma.Decimal(0)));
        const address = details.shipping_address;
        const shippingName = [address?.first_name, address?.last_name]
            .filter((part) => part && part.trim())
            .join(' ')
            .trim();
        const result = await prisma.$transaction(async (tx) => {
            // Serialise every path into this checkout. Without it, a webhook and
            // the callback poll arriving together would each see orderId=null and
            // both reserve stock.
            await tx.$queryRaw `
                SELECT id FROM "fastrr_checkout_sessions" WHERE "id" = ${sessionId} FOR UPDATE
            `;
            const current = await tx.fastrrCheckoutSession.findUnique({
                where: { id: sessionId },
                select: { orderId: true, userId: true, cartId: true, couponCode: true, discountAmount: true },
            });
            if (!current)
                throw new ApiError(404, 'Checkout session disappeared');
            if (current.orderId) {
                return { orderId: current.orderId, alreadyPlaced: true };
            }
            // Reserve every line or none, in one statement. Fastrr has already
            // taken the money, so a shortfall here is a genuine oversell that a
            // human has to resolve — it must be loud, not silently absorbed.
            const reserveValues = Prisma.join(priced.map((line) => Prisma.sql `(${line.variantId}, ${line.quantity}::int)`));
            const reserved = await tx.$queryRaw(Prisma.sql `
                    UPDATE "inventory" AS i
                    SET "stock" = i."stock" - req.qty,
                        "updated_at" = NOW()
                    FROM (VALUES ${reserveValues}) AS req(variant_id, qty)
                    WHERE i."variant_id" = req.variant_id
                      AND i."stock" >= req.qty
                    RETURNING i."variant_id" AS variant_id
                `);
            if (reserved.length !== priced.length) {
                const ok = new Set(reserved.map((row) => row.variant_id));
                const short = priced.find((line) => !ok.has(line.variantId));
                throw new ApiError(409, `Oversold on variant ${short?.variantId ?? 'unknown'} for paid Fastrr order ${fastrrOrderId}`);
            }
            const order = await tx.order.create({
                data: {
                    userId: current.userId,
                    status: OrderStatus.PLACED,
                    totalAmount: Number(grandTotal.toString()),
                    subTotalAmount: Number(subTotalAmount.toString()),
                    totalTaxAmount: Number(totalTaxAmount.toString()),
                    grandTotal: Number(grandTotal.toString()),
                    // Fastrr's own coupons are reported per order; a Tatvivah coupon
                    // the buyer applied before the overlay is on the session.
                    couponCode: details.coupon_codes?.[0] ?? current.couponCode ?? null,
                    discountAmount: totalDiscount,
                    shippingName: shippingName || null,
                    shippingPhone: address?.phone ?? details.phone ?? null,
                    shippingEmail: address?.email ?? details.email ?? null,
                    shippingAddressLine1: address?.line1 ?? null,
                    shippingAddressLine2: address?.line2 ?? null,
                    shippingCity: address?.city ?? null,
                    shippingPincode: address?.pincode ?? null,
                    shippingNotes: address?.landmark ?? null,
                },
            });
            await tx.orderItem.createMany({
                data: priced.map((line) => ({
                    orderId: order.id,
                    sellerId: line.sellerId,
                    productId: line.productId,
                    variantId: line.variantId,
                    quantity: line.quantity,
                    priceSnapshot: line.unitPrice,
                    sellerPriceSnapshot: line.sellerPrice,
                    adminPriceSnapshot: line.unitPrice,
                    platformMargin: line.unitPrice - line.sellerPrice,
                    taxRate: line.taxRate,
                    taxableAmount: Number(line.taxable.toString()),
                    cgstAmount: Number(line.cgst.toString()),
                    sgstAmount: Number(line.sgst.toString()),
                    igstAmount: Number(line.igst.toString()),
                    totalAmount: Number(line.netGross.toString()),
                })),
            });
            await tx.inventoryMovement.createMany({
                data: priced.map((line) => ({
                    variantId: line.variantId,
                    orderId: order.id,
                    quantity: line.quantity,
                    type: 'RESERVE',
                    // Same movement reason as the native path — this is a checkout,
                    // just one Fastrr hosted. Which channel it came through is
                    // recorded on the payment event instead.
                    reason: 'CHECKOUT',
                })),
            });
            // A Tatvivah coupon is only burned now, once the money is in. Fastrr's
            // own coupons live on their side and are not redeemed against our
            // ledger.
            if (current.couponCode) {
                const coupon = await tx.coupon.findUnique({
                    where: { code: current.couponCode },
                    select: { id: true },
                });
                if (coupon) {
                    await couponService.redeemCouponAfterOrderCreated({
                        tx,
                        couponId: coupon.id,
                        userId: current.userId,
                        orderId: order.id,
                        discountAmount: new Prisma.Decimal(current.discountAmount),
                    });
                }
            }
            // Clear exactly what was bought. The buyer can drop lines inside the
            // overlay, and anything they dropped must stay in their cart.
            if (current.cartId) {
                await tx.$executeRaw `
                    DELETE FROM "cart_items"
                    WHERE "cart_id" = ${current.cartId}
                      AND "variant_id" = ANY(${priced.map((line) => line.variantId)}::text[])
                `;
            }
            const txnId = details.payments?.[0]?.txn_id ??
                details.payments?.[0]?.pg_transaction_id ??
                fastrrOrderId;
            const payment = await tx.payment.create({
                data: {
                    orderId: order.id,
                    userId: current.userId,
                    amount: Number(grandTotal.toString()),
                    provider: PaymentProvider.FASTRR,
                    // COD is collected on delivery, so it stays INITIATED until then —
                    // marking it SUCCESS would tell the settlement ledger money had
                    // arrived that nobody has yet collected.
                    status: PaymentStatus.INITIATED,
                    providerOrderId: fastrrOrderId,
                    providerPaymentId: isCod ? null : txnId,
                },
            });
            await tx.paymentEvent.create({
                data: {
                    paymentId: payment.id,
                    type: PaymentEventType.INITIATED,
                    payload: {
                        source,
                        fastrrOrderId,
                        paymentType: details.payment_type,
                        gateway: details.payments?.[0]?.gateway ?? null,
                        method: details.payments?.[0]?.payment_method ?? null,
                    },
                },
            });
            // The UNIQUE on order_id is the last line of defence against a second
            // order for this checkout.
            await tx.fastrrCheckoutSession.update({
                where: { id: sessionId },
                data: { orderId: order.id, status: FastrrSessionStatus.COMPLETED },
            });
            return {
                orderId: order.id,
                alreadyPlaced: false,
                paymentId: payment.id,
                userId: current.userId,
                txnId,
                productIds: Array.from(new Set(priced.map((line) => line.productId))),
            };
        }, { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS });
        if (result.alreadyPlaced) {
            return { orderId: result.orderId, status: 'COMPLETED', message: 'Order already placed' };
        }
        checkoutLogger.info({
            event: 'fastrr_order_created',
            source,
            fastrrOrderId,
            orderId: result.orderId,
            userId: result.userId,
            paymentType: details.payment_type,
            grandTotal: grandTotal.toString(),
            items: priced.length,
        }, `Fastrr order ${fastrrOrderId} materialised as ${result.orderId}`);
        // Confirmation, invoicing, settlement and notifications all happen after
        // the transaction commits — none of them should be able to roll back an
        // order the buyer has already paid for.
        if (isCod) {
            await this.confirmCodOrder(result.orderId, result.paymentId);
        }
        else {
            await paymentService.handlePaymentSuccess(result.paymentId, result.orderId, result.txnId, { source: `fastrr_${source}`, fastrrOrderId, details });
        }
        await this.invalidate(result.userId, result.orderId, result.productIds);
        return { orderId: result.orderId, status: 'COMPLETED', message: 'Order placed' };
    }
    /**
     * COD confirmation: the seller ships, so the order and its settlement are
     * real, but no money has moved. Deliberately does *not* route through
     * handlePaymentSuccess — that would flip the payment to SUCCESS and tell the
     * ledger funds had been received.
     */
    async confirmCodOrder(orderId, paymentId) {
        const confirmed = await prisma.$transaction(async (tx) => {
            // Claim the transition first. Invoice numbers come from a sequence, so
            // generating one before knowing the update will land would burn a
            // number on every redelivered webhook and leave gaps in the book.
            const claimed = await tx.order.updateMany({
                where: { id: orderId, status: OrderStatus.PLACED },
                data: { status: OrderStatus.CONFIRMED },
            });
            if (claimed.count === 0)
                return false;
            await tx.order.update({
                where: { id: orderId },
                data: {
                    invoiceNumber: await generateInvoiceNumber(tx),
                    invoiceIssuedAt: new Date(),
                },
            });
            return true;
        }, { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS });
        if (!confirmed)
            return;
        paymentLogger.info({ event: 'fastrr_cod_confirmed', orderId, paymentId }, `COD order ${orderId} confirmed — payment pending collection`);
        await commissionService.calculateAndStoreSellerSettlement(orderId);
        await emitOrderPlaced(orderId);
    }
    /**
     * Map Fastrr's variant ids back onto our catalog.
     *
     * Fastrr speaks in the numeric `external_id` surrogate the catalog feed
     * publishes, never our CUIDs. An id we cannot resolve means we would be
     * shipping something we cannot identify, so it stops the order.
     */
    async resolveLines(items) {
        const externalIds = [];
        for (const item of items) {
            if (!/^\d+$/.test(String(item.variant_id))) {
                throw new ApiError(422, `Fastrr sent an unrecognised variant id: ${item.variant_id}`);
            }
            externalIds.push(BigInt(item.variant_id));
        }
        const variants = await prisma.productVariant.findMany({
            where: { externalId: { in: externalIds } },
            select: {
                id: true,
                externalId: true,
                price: true,
                sellerPrice: true,
                adminListingPrice: true,
                product: {
                    select: {
                        id: true,
                        taxRate: true,
                        sellerId: true,
                        seller: { select: { state: true } },
                    },
                },
            },
        });
        const byExternalId = new Map(variants.map((variant) => [variant.externalId.toString(), variant]));
        return items.map((item) => {
            const variant = byExternalId.get(String(item.variant_id));
            if (!variant) {
                throw new ApiError(422, `Fastrr order references variant ${item.variant_id}, which does not exist here`);
            }
            const quantity = Number(item.quantity);
            if (!Number.isInteger(quantity) || quantity < 1) {
                throw new ApiError(422, `Fastrr sent an invalid quantity for variant ${item.variant_id}`);
            }
            return {
                variantId: variant.id,
                productId: variant.product.id,
                sellerId: variant.product.sellerId,
                quantity,
                // The buyer-facing price, which is what we published to Fastrr and
                // therefore what they charged.
                unitPrice: Number(variant.adminListingPrice ?? variant.price),
                sellerPrice: Number(variant.sellerPrice ?? 0),
                taxRate: Number(variant.product.taxRate ?? 0),
                sellerState: variant.product.seller?.state ?? '',
            };
        });
    }
    async markFailed(sessionId, reason) {
        await prisma.fastrrCheckoutSession.updateMany({
            where: { id: sessionId, status: FastrrSessionStatus.INITIATED },
            data: { status: FastrrSessionStatus.FAILED, failureReason: reason },
        });
        checkoutLogger.info({ event: 'fastrr_session_failed', sessionId, reason }, `Fastrr session ${sessionId} failed: ${reason}`);
    }
    /** Best-effort cache and live-update fanout; never blocks a placed order. */
    async invalidate(userId, orderId, productIds) {
        await invalidateCache(CACHE_KEYS.CART(userId)).catch(() => undefined);
        void Promise.allSettled([
            invalidateCacheByPattern(`orders:buyer:${userId}:*`),
            invalidateCacheByPattern('orders:detail:*'),
            ...productIds.map((productId) => invalidateCache(CACHE_KEYS.PRODUCT_DETAIL(productId))),
            invalidateCache(CACHE_KEYS.PRODUCTS_LIST),
            invalidateCacheByPattern('products:list:*'),
            invalidateCacheByPattern('search:*'),
        ]);
        void dispatchFreshness({
            type: 'order.updated',
            entityId: orderId,
            tags: [
                CACHE_TAGS.orders,
                CACHE_TAGS.userOrders,
                CACHE_TAGS.sellerOrders,
                CACHE_TAGS.products,
                orderTag(orderId),
                ...productIds.map((productId) => productTag(productId)),
            ],
            audience: { allAuthenticated: true },
        }).catch((error) => {
            checkoutLogger.warn({ orderId, error }, 'fastrr_freshness_dispatch_failed');
        });
    }
}
export const fastrrOrderService = new FastrrOrderService();
//# sourceMappingURL=fastrr-order.service.js.map