import { paymentRepository } from '../repositories/payment.repository.js';
import { PaymentStatus, PaymentEventType, PaymentProvider, OrderStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { emitPaymentSuccess, emitPaymentFailed } from '../events/order.events.js';
import { paymentLogger } from '../config/logger.js';
import { paymentSuccessTotal, staleCancelTotal, refundSuccessTotal } from '../config/metrics.js';
import { recordPaymentFailure } from '../monitoring/alerts.js';
import { generateInvoiceNumber } from '../utils/invoice.util.js';
import { commissionService } from './commission.service.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, orderTag } from '../live/cache-tags.js';
import { phonepeService } from './phonepe.service.js';
import { isPhonePeConfigured } from './phonepe.client.js';
import { env } from '../config/env.js';
// =====================================================================
// Payment service.
//
// Active gateway: PhonePe (Standard Checkout v2, redirect flow).
//   - initiatePayment       → create a PhonePe order, return its redirectUrl
//   - verifyPhonePePayment  → confirm state server-to-server, then confirm order
//   - handlePaymentSuccess  → confirm order + settlements (verify + webhook)
//   - handlePaymentFailure  → mark payment FAILED + notify
//   - processRefund         → mark REFUNDED + call PhonePe refund
//   - cancelStaleOrders     → cron cleanup of unpaid PLACED orders
// =====================================================================
/** Maximum age (ms) of a PLACED order before stale-cleanup cancels it. */
const STALE_ORDER_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TX_MAX_WAIT_MS = 20000;
const TX_TIMEOUT_MS = 30000;
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
/** A redirect target the buyer's own phone or browser could never reach. */
function isUnreachablePublicUrl(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return (host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '0.0.0.0' ||
            host === '::1' ||
            host.endsWith('.local') ||
            // Private ranges: fine on a dev LAN, dead for a real buyer.
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host));
    }
    catch {
        return true;
    }
}
/**
 * Where PhonePe sends the buyer back to after the hosted checkout page.
 *
 * This is the single most damaging value to get wrong: PhonePe takes the money
 * and then hands the buyer to whatever URL we supplied. If that is a developer's
 * `localhost:3001`, the buyer lands on a dead page on their own phone with the
 * payment already taken — which looks exactly like "payments are broken" even
 * though the charge succeeded.
 *
 * `.env` in this repo carries `PHONEPE_WEB_REDIRECT_BASE_URL=http://localhost:3001`
 * for local work, and that variable takes precedence over FRONTEND_BASE_URL. So
 * the one thing that must not happen is that value reaching a real buyer. A
 * private or loopback host is rejected outright rather than trusted.
 */
function resolvePublicRedirectBase() {
    const candidates = [
        env.PHONEPE_WEB_REDIRECT_BASE_URL,
        env.FRONTEND_BASE_URL,
        'https://www.tatvivahtrends.com',
    ];
    for (const candidate of candidates) {
        if (!candidate)
            continue;
        const trimmed = candidate.trim().replace(/\/$/, '');
        if (!trimmed)
            continue;
        if (isUnreachablePublicUrl(trimmed)) {
            paymentLogger.warn({ event: 'phonepe_redirect_base_rejected', candidate: trimmed }, 'Ignoring a non-public PhonePe redirect base — a buyer could not reach it');
            continue;
        }
        return trimmed;
    }
    return 'https://www.tatvivahtrends.com';
}
function isTransactionStartTimeout(error) {
    if (!(error instanceof Error))
        return false;
    const msg = error.message.toLowerCase();
    return (msg.includes('unable to start a transaction in the given time') ||
        msg.includes('transaction api error') ||
        msg.includes('p2028'));
}
export class PaymentService {
    async findOrderForPayment(userId, orderId) {
        return prisma.order.findFirst({
            where: { id: orderId, userId },
            select: {
                id: true,
                userId: true,
                status: true,
                createdAt: true,
                totalAmount: true,
                grandTotal: true,
                subTotalAmount: true,
                totalTaxAmount: true,
            },
        });
    }
    /**
     * The amount to charge for an order.
     *
     * This is `grandTotal` and nothing else. Checkout is the single place that prices an
     * order: it applies the coupon, computes CGST/SGST/IGST, adds the flat GST fee and
     * the shipping fee (when the admin has them enabled) and writes the result to
     * `grandTotal` — so re-deriving anything here can only disagree with what the buyer
     * was shown.
     *
     * A previous version tried to be defensive by taking
     * `max(totalAmount, grandTotal, subTotal + tax + shipping)`, inferring the shipping
     * fee as `grandTotal - subTotal - tax` and falling back to a hardcoded ₹180 when
     * that came out as 0. But 0 is the correct, normal answer whenever the admin has the
     * shipping charge switched off — so the fallback fired on ordinary orders and
     * charged every buyer ₹180 more than their order total.
     */
    resolvePayableAmount(order) {
        const grandTotal = toNumber(order.grandTotal);
        if (grandTotal > 0) {
            return roundMoney(grandTotal);
        }
        // Older orders written before grandTotal existed only carry totalAmount.
        const totalAmount = toNumber(order.totalAmount);
        if (totalAmount > 0) {
            return roundMoney(totalAmount);
        }
        throw new ApiError(500, 'Order has no payable amount');
    }
    /**
     * Where PhonePe redirects the buyer after checkout.
     * WEB → frontend callback page; MOBILE → app deep link (if configured).
     */
    buildPhonePeRedirectUrl(orderId, platform) {
        const configured = platform === 'MOBILE' ? env.PHONEPE_MOBILE_REDIRECT_URL : undefined;
        if (configured) {
            // PhonePe Standard Checkout validates merchantUrls.redirectUrl and
            // accepts https only. A custom app scheme — `mobile://checkout` — is
            // rejected during checkout, which surfaces to the buyer as
            // "Something went wrong" on PhonePe's own domain AFTER the page has
            // loaded. It looks like a gateway outage; it is a malformed request.
            //
            // Returning the buyer to the app is still the goal, but it has to be
            // done by having the https callback page deep-link onward, not by
            // handing PhonePe a scheme it will not take.
            if (/^https:\/\//i.test(configured) && !isUnreachablePublicUrl(configured)) {
                const sep = configured.includes('?') ? '&' : '?';
                return `${configured}${sep}orderId=${encodeURIComponent(orderId)}`;
            }
            paymentLogger.warn({ event: 'phonepe_mobile_redirect_rejected', configured }, 'PHONEPE_MOBILE_REDIRECT_URL is not a public https URL — PhonePe would reject it. Falling back to the web callback.');
        }
        const base = resolvePublicRedirectBase();
        return `${base}/checkout/phonepe/callback?orderId=${encodeURIComponent(orderId)}`;
    }
    // ------------------------------------------------------------------
    // Initiate a PhonePe payment for a PLACED order.
    // Creates/reuses the payment row, creates the PhonePe order, and returns
    // the redirectUrl the client sends the buyer to.
    // ------------------------------------------------------------------
    async initiatePayment(userId, orderId, platform = 'WEB') {
        if (!isPhonePeConfigured()) {
            throw new ApiError(500, 'PhonePe is not configured');
        }
        const [order, existingPayment] = await Promise.all([
            this.findOrderForPayment(userId, orderId),
            paymentRepository.findPaymentByOrderId(orderId),
        ]);
        if (!order) {
            throw new ApiError(404, 'Order not found or access denied');
        }
        if (order.status !== OrderStatus.PLACED) {
            throw new ApiError(400, `Cannot initiate payment for order with status ${order.status}`);
        }
        if (Date.now() - new Date(order.createdAt).getTime() > STALE_ORDER_TTL_MS) {
            throw new ApiError(410, 'Order has expired. Please place a new order.');
        }
        if (existingPayment && existingPayment.status === PaymentStatus.SUCCESS) {
            throw new ApiError(400, 'Order already paid');
        }
        const payableAmount = this.resolvePayableAmount(order);
        // The merchant order id is generated locally, so it can be persisted in the
        // same write that creates/resets the payment row. Writing it up front also
        // closes a real gap: previously it was saved only AFTER PhonePe returned, so
        // a crash in between left a live PhonePe order that no webhook could ever be
        // matched to — a paid order that would never be confirmed.
        const merchantOrderId = phonepeService.buildMerchantOrderId(orderId);
        const redirectUrl = this.buildPhonePeRedirectUrl(orderId, platform);
        // Create/reset the payment row (reuse on retry).
        let payment;
        if (existingPayment) {
            payment = await prisma.payment.update({
                where: { id: existingPayment.id },
                data: {
                    status: PaymentStatus.INITIATED,
                    provider: PaymentProvider.PHONEPE,
                    amount: payableAmount,
                    providerOrderId: merchantOrderId,
                    providerPaymentId: null,
                    providerSignature: null,
                },
            });
        }
        else {
            payment = await paymentRepository.createPayment({
                orderId,
                userId,
                amount: payableAmount,
                currency: 'INR',
                provider: PaymentProvider.PHONEPE,
                status: PaymentStatus.INITIATED,
                providerOrderId: merchantOrderId,
            });
        }
        // Audit trail only — nothing reads it on this path, and the payment row itself
        // already records the status. Making the buyer wait several cross-region
        // round-trips for it just delays the redirect to PhonePe.
        void paymentRepository
            .createPaymentEvent({
            paymentId: payment.id,
            type: PaymentEventType.INITIATED,
            payload: { provider: 'PHONEPE', amount: payableAmount },
        })
            .catch((error) => {
            paymentLogger.warn({ event: 'payment_event_write_failed', paymentId: payment.id, error }, 'Failed to record INITIATED payment event');
        });
        // MOBILE and WEB take different PhonePe endpoints.
        //
        // PhonePe stopped allowing a WebView or browser redirect inside a mobile
        // app; the hosted checkout page refuses to render there, which is what
        // showed the buyer "Something went wrong" on PhonePe's own domain after
        // they had already committed to paying. Apps must open the native SDK,
        // which needs an order token rather than a URL.
        //
        // The website is unaffected and still uses the redirect flow.
        if (platform === 'MOBILE') {
            const sdkOrder = await phonepeService.createSdkOrder(payableAmount, merchantOrderId, { orderId, userId });
            if (sdkOrder.merchantOrderId && sdkOrder.merchantOrderId !== merchantOrderId) {
                await paymentRepository.updateProviderOrderId(payment.id, sdkOrder.merchantOrderId);
            }
            return {
                paymentId: payment.id,
                orderId: sdkOrder.merchantOrderId,
                phonepeOrderId: sdkOrder.phonepeOrderId,
                // What the SDK needs. No redirectUrl: there is no browser hop.
                sdkToken: sdkOrder.token,
                sdkExpireAt: sdkOrder.expireAt,
                merchantId: env.PHONEPE_MERCHANT_ID ?? env.PHONEPE_CLIENT_ID ?? '',
                environment: env.PHONEPE_ENV,
                amount: sdkOrder.amount,
                currency: 'INR',
                provider: 'PHONEPE',
            };
        }
        const phonepeOrder = await phonepeService.createOrder(payableAmount, merchantOrderId, redirectUrl, { orderId, userId });
        // Normally PhonePe echoes back the id we sent, so this write is skipped
        // entirely. Only reconcile if it ever differs.
        if (phonepeOrder.merchantOrderId && phonepeOrder.merchantOrderId !== merchantOrderId) {
            await paymentRepository.updateProviderOrderId(payment.id, phonepeOrder.merchantOrderId);
        }
        return {
            paymentId: payment.id,
            orderId: phonepeOrder.merchantOrderId,
            phonepeOrderId: phonepeOrder.phonepeOrderId,
            redirectUrl: phonepeOrder.redirectUrl,
            amount: phonepeOrder.amount,
            currency: 'INR',
            provider: 'PHONEPE',
        };
    }
    /** Retry payment for a PLACED order whose payment is FAILED/INITIATED. */
    async retryPayment(userId, orderId, platform = 'WEB') {
        const order = await this.findOrderForPayment(userId, orderId);
        if (!order) {
            throw new ApiError(404, 'Order not found or access denied');
        }
        if (order.status !== OrderStatus.PLACED) {
            throw new ApiError(400, `Cannot retry payment for order with status ${order.status}`);
        }
        const existingPayment = await paymentRepository.findPaymentByOrderId(orderId);
        if (existingPayment && existingPayment.status === PaymentStatus.SUCCESS) {
            throw new ApiError(400, 'Order already paid');
        }
        return this.initiatePayment(userId, orderId, platform);
    }
    // ------------------------------------------------------------------
    // Verify a PhonePe payment (redirect callback / client polling).
    // The redirect carries no signature, so the trusted confirmation is a
    // server-to-server Order Status call.
    // ------------------------------------------------------------------
    async verifyPhonePePayment(userId, orderId) {
        const payment = await paymentRepository.findPaymentByOrderId(orderId);
        if (!payment) {
            throw new ApiError(404, 'Payment not found');
        }
        if (payment.userId !== userId) {
            throw new ApiError(403, 'Unauthorized');
        }
        if (payment.status === PaymentStatus.SUCCESS) {
            return { status: 'SUCCESS', paymentId: payment.id, message: 'Payment already verified' };
        }
        if (payment.provider !== PaymentProvider.PHONEPE || !payment.providerOrderId) {
            // No PhonePe attempt on record yet (e.g. order creation failed, or the
            // order predates PhonePe). Report PENDING instead of throwing so the
            // orders-page self-heal doesn't spam 400s into the logs.
            return {
                status: 'PENDING',
                paymentId: payment.id,
                message: 'No PhonePe payment attempt for this order',
            };
        }
        // A gateway hiccup here is not a failed payment. Cancelled and abandoned
        // orders can make this call error or 502, and letting that propagate showed
        // the buyer "Payment Not Completed — Internal server error" on what may be a
        // perfectly good order. Report PENDING and let the webhook settle it.
        let statusResponse;
        try {
            statusResponse = await phonepeService.getOrderStatus(payment.providerOrderId);
        }
        catch (error) {
            paymentLogger.warn({ event: 'phonepe_status_check_failed', orderId, paymentId: payment.id, error }, 'PhonePe status check failed; reporting PENDING');
            return {
                status: 'PENDING',
                paymentId: payment.id,
                message: 'Could not reach PhonePe. We will confirm this shortly.',
            };
        }
        if (statusResponse.state === 'COMPLETED') {
            const transactionId = statusResponse.paymentDetails?.[0]?.transactionId ?? statusResponse.orderId;
            try {
                await this.handlePaymentSuccess(payment.id, payment.orderId, transactionId, { merchantOrderId: payment.providerOrderId, phonepeOrderId: statusResponse.orderId, source: 'status_check' });
            }
            catch (error) {
                if (isTransactionStartTimeout(error)) {
                    const latest = await paymentRepository.findPaymentById(payment.id);
                    if (latest?.status === PaymentStatus.SUCCESS) {
                        return { status: 'SUCCESS', paymentId: payment.id, message: 'Payment already verified' };
                    }
                    throw new ApiError(503, 'Payment is being finalized. Please refresh order status in a few seconds.');
                }
                throw error;
            }
            return { status: 'SUCCESS', paymentId: payment.id, message: 'Payment verified' };
        }
        if (statusResponse.state === 'FAILED') {
            await this.handlePaymentFailure(payment.id, {
                merchantOrderId: payment.providerOrderId,
                phonepeOrderId: statusResponse.orderId,
                source: 'status_check',
            });
            return { status: 'FAILED', paymentId: payment.id, message: 'Payment failed' };
        }
        return { status: 'PENDING', paymentId: payment.id, message: 'Payment is still pending' };
    }
    // ------------------------------------------------------------------
    // Refund processing (idempotent, crash-safe)
    //
    // Ledger-only: marks the payment REFUNDED. With no gateway wired up,
    // the actual money return is handled manually/offline for now; the new
    // gateway will add its refund call here when rebuilt.
    // ------------------------------------------------------------------
    async processRefund(orderId) {
        const payment = await paymentRepository.findPaymentByOrderId(orderId);
        if (!payment) {
            return { refundTriggered: false, alreadyRefunded: false, paymentStatus: null };
        }
        if (payment.status === PaymentStatus.REFUNDED) {
            return {
                refundTriggered: false,
                alreadyRefunded: true,
                paymentStatus: PaymentStatus.REFUNDED,
            };
        }
        if (payment.status !== PaymentStatus.SUCCESS) {
            return {
                refundTriggered: false,
                alreadyRefunded: false,
                paymentStatus: payment.status,
            };
        }
        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.payment.updateMany({
                where: { id: payment.id, status: PaymentStatus.SUCCESS },
                data: { status: PaymentStatus.REFUNDED },
            });
            if (result.count === 0) {
                return false;
            }
            await tx.paymentEvent.create({
                data: {
                    paymentId: payment.id,
                    type: PaymentEventType.WEBHOOK,
                    payload: { event: 'REFUND_INITIATED', orderId },
                },
            });
            return true;
        });
        if (!updated) {
            return {
                refundTriggered: false,
                alreadyRefunded: true,
                paymentStatus: PaymentStatus.REFUNDED,
            };
        }
        // Call PhonePe refund outside the tx. On failure, revert to SUCCESS so
        // we never leave a REFUNDED row without an actual refund.
        if (payment.provider === PaymentProvider.PHONEPE
            && payment.providerOrderId
            && isPhonePeConfigured()) {
            try {
                await phonepeService.initiateRefund(`rf_${payment.id}`, payment.providerOrderId, payment.amount);
            }
            catch (error) {
                paymentLogger.error({ orderId, paymentId: payment.id, error: error?.message }, 'refund_provider_failed_reverting');
                await prisma.payment.updateMany({
                    where: { id: payment.id, status: PaymentStatus.REFUNDED },
                    data: { status: PaymentStatus.SUCCESS },
                });
                throw new ApiError(502, `Refund API failed: ${error?.message ?? 'unknown error'}`);
            }
        }
        refundSuccessTotal.inc();
        paymentLogger.info({ orderId, paymentId: payment.id }, 'refund_processed');
        return {
            refundTriggered: true,
            alreadyRefunded: false,
            paymentStatus: PaymentStatus.REFUNDED,
        };
    }
    // ------------------------------------------------------------------
    // Get payment details
    // ------------------------------------------------------------------
    async getPaymentDetails(orderId, userId) {
        const payment = await paymentRepository.findPaymentByOrderId(orderId);
        if (!payment) {
            throw new ApiError(404, 'Payment not found');
        }
        if (payment.userId !== userId) {
            throw new ApiError(403, 'Unauthorized');
        }
        return payment;
    }
    // ------------------------------------------------------------------
    // Shared success handler — idempotent via optimistic lock inside tx.
    // A future gateway's verify/webhook should converge here to confirm
    // the order and create settlements.
    // ------------------------------------------------------------------
    async handlePaymentSuccess(paymentId, orderId, providerPaymentId, payload, providerSignature) {
        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.payment.updateMany({
                where: { id: paymentId, status: { not: PaymentStatus.SUCCESS } },
                data: {
                    status: PaymentStatus.SUCCESS,
                    providerPaymentId,
                    ...(providerSignature ? { providerSignature } : {})
                }
            });
            if (updated.count === 0) {
                return { alreadyProcessed: true };
            }
            await tx.paymentEvent.create({
                data: { paymentId, type: PaymentEventType.SUCCESS, payload }
            });
            const invoiceNumber = await generateInvoiceNumber(tx);
            await tx.order.update({
                where: { id: orderId },
                data: {
                    status: OrderStatus.CONFIRMED,
                    invoiceNumber,
                    invoiceIssuedAt: new Date(),
                },
            });
            return { alreadyProcessed: false };
        }, {
            maxWait: TX_MAX_WAIT_MS,
            timeout: TX_TIMEOUT_MS,
        });
        if (result.alreadyProcessed)
            return;
        paymentSuccessTotal.inc();
        paymentLogger.info({
            event: 'payment_success',
            orderId,
            paymentId,
            providerPaymentId,
        }, `Payment succeeded for order ${orderId}`);
        await commissionService.calculateAndStoreSellerSettlement(orderId);
        await emitPaymentSuccess(orderId);
        await dispatchFreshness({
            type: 'payment.updated',
            entityId: orderId,
            tags: [
                CACHE_TAGS.payments,
                CACHE_TAGS.orders,
                CACHE_TAGS.userOrders,
                CACHE_TAGS.sellerOrders,
                orderTag(orderId),
            ],
            audience: { allAuthenticated: true },
        });
    }
    // ------------------------------------------------------------------
    // Shared failure handler — marks payment FAILED + notifies buyer.
    // ------------------------------------------------------------------
    async handlePaymentFailure(paymentId, payload) {
        const payment = await paymentRepository.findPaymentById(paymentId);
        if (!payment)
            return;
        if (payment.status === PaymentStatus.SUCCESS)
            return;
        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: paymentId },
                data: { status: PaymentStatus.FAILED }
            });
            await tx.paymentEvent.create({
                data: { paymentId, type: PaymentEventType.FAILED, payload }
            });
        });
        if (payment.orderId) {
            await emitPaymentFailed(payment.orderId);
            await dispatchFreshness({
                type: 'payment.updated',
                entityId: payment.orderId,
                tags: [
                    CACHE_TAGS.payments,
                    CACHE_TAGS.orders,
                    CACHE_TAGS.userOrders,
                    orderTag(payment.orderId),
                ],
                audience: { allAuthenticated: true },
            });
        }
        recordPaymentFailure();
        paymentLogger.warn({
            event: 'payment_failure',
            paymentId,
            orderId: payment.orderId,
        }, `Payment failed for payment ${paymentId}`);
        // Inventory is released by cancelStaleOrders when the TTL expires.
    }
    // ------------------------------------------------------------------
    // Stale order auto-cancellation.
    // Cancels PLACED orders older than STALE_ORDER_TTL_MS whose payment is
    // not SUCCESS, releases reserved inventory, and logs a FAILED event.
    // ------------------------------------------------------------------
    async cancelStaleOrders() {
        const cutoff = new Date(Date.now() - STALE_ORDER_TTL_MS);
        const staleOrders = await prisma.order.findMany({
            where: {
                status: OrderStatus.PLACED,
                createdAt: { lt: cutoff },
                OR: [
                    { payment: { status: { not: PaymentStatus.SUCCESS } } },
                    { payment: null },
                ],
            },
            include: { payment: true },
        });
        let cancelledCount = 0;
        for (const order of staleOrders) {
            try {
                const reserveMovements = await prisma.inventoryMovement.findMany({
                    where: { orderId: order.id, type: 'RESERVE' },
                    select: { variantId: true, quantity: true },
                });
                const wasCancelled = await prisma.$transaction(async (tx) => {
                    const updated = await tx.order.updateMany({
                        where: { id: order.id, status: OrderStatus.PLACED },
                        data: { status: OrderStatus.CANCELLED },
                    });
                    if (updated.count === 0) {
                        return false;
                    }
                    for (const movement of reserveMovements) {
                        await tx.inventory.update({
                            where: { variantId: movement.variantId },
                            data: { stock: { increment: movement.quantity } },
                        });
                        await tx.inventoryMovement.create({
                            data: {
                                variantId: movement.variantId,
                                orderId: order.id,
                                quantity: movement.quantity,
                                type: 'RELEASE',
                                reason: 'STALE_CLEANUP',
                            },
                        });
                    }
                    if (order.payment) {
                        const updatedPayment = await tx.payment.updateMany({
                            where: { id: order.payment.id, status: PaymentStatus.INITIATED },
                            data: { status: PaymentStatus.FAILED },
                        });
                        if (updatedPayment.count > 0) {
                            await tx.paymentEvent.create({
                                data: {
                                    paymentId: order.payment.id,
                                    type: PaymentEventType.FAILED,
                                    payload: { reason: 'stale_order_auto_cancel' },
                                },
                            });
                        }
                    }
                    return true;
                }, {
                    maxWait: TX_MAX_WAIT_MS,
                    timeout: TX_TIMEOUT_MS,
                });
                if (wasCancelled) {
                    cancelledCount++;
                    staleCancelTotal.inc();
                    paymentLogger.info({
                        event: 'stale_order_cancelled',
                        orderId: order.id,
                        userId: order.userId,
                    }, `Stale order cancelled: ${order.id}`);
                }
            }
            catch (err) {
                paymentLogger.error({
                    event: 'stale_order_cancel_failed',
                    orderId: order.id,
                    error: err instanceof Error ? err.message : String(err),
                }, `Failed to cancel stale order ${order.id}`);
            }
        }
        return { cancelled: cancelledCount, total: staleOrders.length };
    }
}
export const paymentService = new PaymentService();
//# sourceMappingURL=payment.service.js.map