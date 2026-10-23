
import { paymentRepository } from '../repositories/payment.repository.js';
import { savedPaymentsService } from './saved-payments.service.js';
import { walletService } from './wallet.service.js';
import { PaymentStatus, PaymentEventType, PaymentProvider, OrderStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { emitOrderPlaced, emitPaymentSuccess, emitPaymentFailed } from '../events/order.events.js';
import { paymentLogger } from '../config/logger.js';
import { paymentSuccessTotal, staleCancelTotal, refundSuccessTotal } from '../config/metrics.js';
import { recordPaymentFailure } from '../monitoring/alerts.js';
import { generateInvoiceNumber } from '../utils/invoice.util.js';
import { commissionService } from './commission.service.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, orderTag } from '../live/cache-tags.js';
import {
    captureRazorpayPayment,
    createRazorpayOrder,
    fetchRazorpayOrderPayments,
    fetchRazorpayPayment,
    isRazorpayConfigured,
    isValidCheckoutSignature,
    refundRazorpayPayment,
    toPaise,
    type RazorpayPayment,
} from './razorpay.client.js';
import { env } from '../config/env.js';
import { sellerAdsService } from './seller-center/ads.service.js';

// =====================================================================
// Payment service.
//
// Gateway: Razorpay (Standard Checkout on web, native SDK in the app).
//   - initiatePayment        → create (or reuse) the Razorpay order for our order
//   - verifyRazorpayPayment  → after Checkout returns: check signature, then settle
//   - syncRazorpayOrder      → ask Razorpay for the order's payments and settle
//   - handlePaymentSuccess   → confirm order + settlements (verify + webhook)
//   - handlePaymentFailure   → mark payment FAILED + notify
//   - processRefund          → mark REFUNDED + call Razorpay refund
//   - cancelStaleOrders      → cron cleanup of unpaid PLACED orders
//
// One Razorpay order per KTMONA order: Razorpay accepts repeated attempts on
// the same order, so retries reuse it and every path (verify, webhook, sweep)
// looks up the same providerOrderId.
// =====================================================================

/** Maximum age (ms) of a PLACED order before stale-cleanup cancels it. */
const STALE_ORDER_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TX_MAX_WAIT_MS = 20000;
const TX_TIMEOUT_MS = 30000;
// No fee constants here on purpose. Pricing belongs to checkout/settings.service; a
// second copy of the shipping fee in this file is what let payments drift ₹180 above
// the order total.

export type PaymentOutcome = 'SUCCESS' | 'FAILED' | 'PENDING';

type PaymentRow = NonNullable<Awaited<ReturnType<typeof paymentRepository.findPaymentByOrderId>>>;

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isTransactionStartTimeout(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
        msg.includes('unable to start a transaction in the given time') ||
        msg.includes('transaction api error') ||
        msg.includes('p2028')
    );
}

export class PaymentService {

    private async findOrderForPayment(userId: string, orderId: string) {
        return prisma.order.findFirst({
            where: { id: orderId, userId },
            select: {
                id: true,
                userId: true,
                status: true,
                createdAt: true,
                totalAmount: true,
                grandTotal: true,
                walletAmount: true,
                subTotalAmount: true,
                totalTaxAmount: true,
                shippingName: true,
                shippingEmail: true,
                shippingPhone: true,
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
    private resolvePayableAmount(order: {
        totalAmount: number;
        grandTotal?: number | null;
        walletAmount?: number | null;
    }): number {
        const grandTotal = toNumber(order.grandTotal);
        if (grandTotal > 0) {
            // Cashback wallet money already covers part of it.
            return roundMoney(grandTotal - toNumber(order.walletAmount));
        }

        // Older orders written before grandTotal existed only carry totalAmount.
        const totalAmount = toNumber(order.totalAmount);
        if (totalAmount > 0) {
            return roundMoney(totalAmount);
        }

        throw new ApiError(500, 'Order has no payable amount');
    }

    // ------------------------------------------------------------------
    // Start a Razorpay payment for a PLACED order.
    // Returns what Checkout (web) or the native SDK (app) needs to open.
    // ------------------------------------------------------------------

    async initiatePayment(userId: string, orderId: string) {
        if (!isRazorpayConfigured()) {
            throw new ApiError(503, 'Online payments are not available right now. Please try again later.');
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

        // Reuse the Razorpay order from an earlier attempt: a buyer who closed
        // Checkout and paid later on the same order must still be matched.
        const reusable =
            existingPayment?.provider === PaymentProvider.RAZORPAY
            && existingPayment.providerOrderId
            && roundMoney(existingPayment.amount) === payableAmount
                ? existingPayment.providerOrderId
                : null;

        const razorpayOrderId =
            reusable
            ?? (await createRazorpayOrder({ amount: payableAmount, receipt: orderId, notes: { orderId, userId } })).id;

        let payment;
        if (existingPayment) {
            payment = await prisma.payment.update({
                where: { id: existingPayment.id },
                data: {
                    status: PaymentStatus.INITIATED,
                    provider: PaymentProvider.RAZORPAY,
                    amount: payableAmount,
                    providerOrderId: razorpayOrderId,
                    ...(reusable ? {} : { providerPaymentId: null, providerSignature: null }),
                },
            });
        } else {
            payment = await paymentRepository.createPayment({
                orderId,
                userId,
                amount: payableAmount,
                currency: 'INR',
                provider: PaymentProvider.RAZORPAY,
                status: PaymentStatus.INITIATED,
                providerOrderId: razorpayOrderId,
            });
        }

        // Audit trail only; the payment row already records the status.
        void paymentRepository
            .createPaymentEvent({
                paymentId: payment.id,
                type: PaymentEventType.INITIATED,
                payload: { provider: 'RAZORPAY', amount: payableAmount, razorpayOrderId, reused: Boolean(reusable) },
            })
            .catch((error) => {
                paymentLogger.warn(
                    { event: 'payment_event_write_failed', paymentId: payment.id, error },
                    'Failed to record INITIATED payment event',
                );
            });

        // Lets Checkout show (and offer to save) the buyer's cards/UPI.
        const customerId = await savedPaymentsService.ensureCustomerId(userId, {
            name: order.shippingName,
            email: order.shippingEmail,
            phone: order.shippingPhone,
        });

        return {
            paymentId: payment.id,
            orderId,
            razorpayOrderId,
            ...(customerId ? { customerId } : {}),
            /** Public key id; Checkout needs it to open. */
            keyId: env.RAZORPAY_KEY_ID!,
            /** In paise, as Checkout expects. */
            amount: toPaise(payableAmount),
            currency: 'INR',
            provider: 'RAZORPAY',
            prefill: {
                name: order.shippingName ?? undefined,
                email: order.shippingEmail ?? undefined,
                contact: order.shippingPhone ?? undefined,
            },
        };
    }

    /** Retry payment for a PLACED order whose payment is FAILED/INITIATED. */
    async retryPayment(userId: string, orderId: string) {
        return this.initiatePayment(userId, orderId);
    }

    // ------------------------------------------------------------------
    // Confirm a payment.
    //
    // Checkout's success handler posts the signed ids here. The signature
    // proves the ids came from Razorpay for our order; the payment itself is
    // then read back from Razorpay so the amount and state are authoritative.
    // Without ids (orders-page self-heal, or a buyer who closed the tab), the
    // order's payments are listed from Razorpay instead.
    // ------------------------------------------------------------------

    async verifyRazorpayPayment(
        userId: string,
        input: { orderId: string; razorpayPaymentId?: string | undefined; razorpaySignature?: string | undefined },
    ): Promise<{ status: PaymentOutcome; paymentId: string; message: string }> {
        const payment = await paymentRepository.findPaymentByOrderId(input.orderId);
        if (!payment) {
            throw new ApiError(404, 'Payment not found');
        }
        if (payment.userId !== userId) {
            throw new ApiError(403, 'Unauthorized');
        }
        if (payment.status === PaymentStatus.SUCCESS) {
            return { status: 'SUCCESS', paymentId: payment.id, message: 'Payment already verified' };
        }
        if (payment.provider !== PaymentProvider.RAZORPAY || !payment.providerOrderId) {
            // Nothing on record to check (e.g. payment start failed, or a legacy order).
            return { status: 'PENDING', paymentId: payment.id, message: 'No online payment attempt for this order' };
        }

        if (input.razorpayPaymentId && input.razorpaySignature) {
            if (!isValidCheckoutSignature(payment.providerOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
                paymentLogger.warn(
                    { event: 'razorpay_signature_invalid', orderId: input.orderId, paymentId: payment.id },
                    'Razorpay checkout signature did not match',
                );
                throw new ApiError(400, 'Payment verification failed');
            }
        }

        let outcome: PaymentOutcome;
        try {
            outcome = input.razorpayPaymentId
                ? await this.settleRazorpayPayment(
                    payment,
                    await fetchRazorpayPayment(input.razorpayPaymentId),
                    'checkout_return',
                    input.razorpaySignature,
                )
                : await this.syncRazorpayOrder(payment, 'status_check');
        } catch (error) {
            if (isTransactionStartTimeout(error)) {
                const latest = await paymentRepository.findPaymentById(payment.id);
                if (latest?.status === PaymentStatus.SUCCESS) {
                    return { status: 'SUCCESS', paymentId: payment.id, message: 'Payment already verified' };
                }
                throw new ApiError(503, 'Payment is being finalized. Please refresh order status in a few seconds.');
            }
            if (error instanceof ApiError && error.statusCode === 502) {
                // A gateway hiccup is not a failed payment; the webhook settles it.
                return { status: 'PENDING', paymentId: payment.id, message: 'We will confirm this payment shortly.' };
            }
            throw error;
        }

        const message =
            outcome === 'SUCCESS' ? 'Payment verified' : outcome === 'FAILED' ? 'Payment failed' : 'Payment is still pending';
        return { status: outcome, paymentId: payment.id, message };
    }

    /** Settle from whatever Razorpay holds for this order's Razorpay order. */
    async syncRazorpayOrder(payment: PaymentRow, source: string): Promise<PaymentOutcome> {
        if (!payment.providerOrderId) return 'PENDING';
        const attempts = await fetchRazorpayOrderPayments(payment.providerOrderId);
        const paid =
            attempts.find((p) => p.status === 'captured')
            ?? attempts.find((p) => p.status === 'authorized');
        if (paid) return this.settleRazorpayPayment(payment, paid, source);
        // Failed attempts do not fail the order: the buyer can still pay on it.
        return 'PENDING';
    }

    /**
     * Turn one Razorpay payment into our order state. Captures an authorized
     * payment (accounts without auto-capture), and only confirms the order when
     * the captured amount covers what we asked for.
     */
    async settleRazorpayPayment(
        payment: PaymentRow,
        rzp: RazorpayPayment,
        source: string,
        signature?: string,
    ): Promise<PaymentOutcome> {
        if (rzp.order_id !== payment.providerOrderId) {
            paymentLogger.warn(
                { event: 'razorpay_order_mismatch', paymentId: payment.id, expected: payment.providerOrderId, got: rzp.order_id },
                'Razorpay payment belongs to a different order',
            );
            throw new ApiError(400, 'Payment does not belong to this order');
        }

        let current = rzp;
        if (current.status === 'authorized') {
            current = await captureRazorpayPayment(current.id, current.amount);
        }

        if (current.status === 'failed') return 'PENDING';
        if (current.status !== 'captured' && current.status !== 'refunded') return 'PENDING';

        if (current.amount < toPaise(payment.amount)) {
            paymentLogger.error(
                { event: 'razorpay_amount_short', paymentId: payment.id, expected: toPaise(payment.amount), got: current.amount },
                'Razorpay captured less than the order total',
            );
            return 'PENDING';
        }

        await this.handlePaymentSuccess(
            payment.id,
            payment.orderId,
            current.id,
            { provider: 'RAZORPAY', razorpayOrderId: current.order_id, razorpayPaymentId: current.id, method: current.method, source },
            signature,
        );
        return 'SUCCESS';
    }

    // ------------------------------------------------------------------
    // Refund processing (idempotent, crash-safe)
    //
    // Marks the payment REFUNDED, then asks Razorpay to return the money.
    // Payments from retired gateways (PhonePe, Shiprocket Checkout) are
    // ledger-only: their money has to be returned from that gateway's dashboard.
    // ------------------------------------------------------------------

    async processRefund(orderId: string): Promise<{
        refundTriggered: boolean;
        alreadyRefunded: boolean;
        paymentStatus: PaymentStatus | null;
    }> {
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

        const updated = await prisma.$transaction(async (tx: any) => {
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

        // Call Razorpay outside the tx. On failure, revert to SUCCESS so we
        // never leave a REFUNDED row without an actual refund.
        if (payment.provider === PaymentProvider.RAZORPAY && payment.providerPaymentId) {
            try {
                await refundRazorpayPayment(payment.providerPaymentId, payment.amount, { orderId, paymentId: payment.id });
            } catch (error: any) {
                paymentLogger.error(
                    { orderId, paymentId: payment.id, error: error?.message },
                    'refund_provider_failed_reverting',
                );
                await prisma.payment.updateMany({
                    where: { id: payment.id, status: PaymentStatus.REFUNDED },
                    data: { status: PaymentStatus.SUCCESS },
                });
                throw new ApiError(502, `Refund API failed: ${error?.message ?? 'unknown error'}`);
            }
        } else {
            paymentLogger.warn(
                { orderId, paymentId: payment.id, provider: payment.provider },
                'refund_ledger_only_manual_payout_needed',
            );
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

    async getPaymentDetails(orderId: string, userId: string) {
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
    // Checkout return, webhook and stale sweep all converge here to confirm
    // the order and create settlements.
    // ------------------------------------------------------------------

    async handlePaymentSuccess(
        paymentId: string,
        orderId: string,
        providerPaymentId: string,
        payload: any,
        providerSignature?: string
    ) {
        const result = await prisma.$transaction(async (tx: any) => {
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

            const invoiceNumber = await generateInvoiceNumber(tx as any);
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

        if (result.alreadyProcessed) return;

        paymentSuccessTotal.inc();
        paymentLogger.info({
            event: 'payment_success',
            orderId,
            paymentId,
            providerPaymentId,
        }, `Payment succeeded for order ${orderId}`);

        await commissionService.calculateAndStoreSellerSettlement(orderId);
        // The order confirmation waits for the money: checkout only sends it for COD.
        await emitOrderPlaced(orderId);
        await emitPaymentSuccess(orderId);
        // Credit the sale to any ad click that led to it (best-effort).
        await sellerAdsService.attributeOrder(orderId).catch((err) =>
            paymentLogger.warn({ err, orderId }, 'Ad attribution failed'),
        );

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

    async handlePaymentFailure(paymentId: string, payload: any) {
        const payment = await paymentRepository.findPaymentById(paymentId);
        if (!payment) return;
        if (payment.status === PaymentStatus.SUCCESS) return;

        await prisma.$transaction(async (tx: any) => {
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
                    // The exclusion lives inside this branch, not alongside it: a
                    // sibling `payment: {...}` filter would AND with the null branch
                    // and stop sweeping orders that have no payment row at all —
                    // exactly the orders whose payment start failed.
                    {
                        payment: {
                            is: {
                                status: { not: PaymentStatus.SUCCESS },
                                // Legacy Shiprocket Checkout orders were created after
                                // payment, so PLACED there meant "paid"; never sweep them.
                                provider: { not: PaymentProvider.FASTRR },
                            },
                        },
                    },
                    { payment: null },
                ],
            },
            include: { payment: true },
        });

        let cancelledCount = 0;

        for (const order of staleOrders) {
            try {
                // A lost webhook or a closed tab must not cancel a paid order:
                // ask Razorpay first, and skip the order if it cannot answer.
                if (order.payment?.provider === PaymentProvider.RAZORPAY && order.payment.providerOrderId) {
                    if (!isRazorpayConfigured()) continue;
                    try {
                        const outcome = await this.syncRazorpayOrder(order.payment, 'stale_sweep');
                        if (outcome === 'SUCCESS') continue;
                    } catch (error) {
                        paymentLogger.warn(
                            { event: 'stale_sweep_razorpay_check_failed', orderId: order.id, error: error instanceof Error ? error.message : String(error) },
                            'Could not check Razorpay; leaving the order for the next sweep',
                        );
                        continue;
                    }
                }

                const reserveMovements = await prisma.inventoryMovement.findMany({
                    where: { orderId: order.id, type: 'RESERVE' },
                    select: { variantId: true, quantity: true },
                });

                const wasCancelled = await prisma.$transaction(async (tx: any) => {
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
                    await walletService.onOrderCancelled(order.id).catch(() => undefined);
                    cancelledCount++;
                    staleCancelTotal.inc();
                    paymentLogger.info({
                        event: 'stale_order_cancelled',
                        orderId: order.id,
                        userId: order.userId,
                    }, `Stale order cancelled: ${order.id}`);
                }
            } catch (err) {
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
