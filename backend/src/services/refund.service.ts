import { RefundInitiator, RefundStatus, PaymentStatus, PaymentProvider } from '@prisma/client';
import { prisma } from '../config/db.js';
import { refundLogger } from '../config/logger.js';
import { phonepeService } from './phonepe.service.js';
import { isPhonePeConfigured } from './phonepe.client.js';
import { initiateFastrrRefund, isFastrrConfigured } from './fastrr.client.js';
import {
    refundCreatedTotal,
    refundLedgerSuccessTotal,
    refundFailedTotal,
    refundOverLimitRejectedTotal,
} from '../config/metrics.js';
import { ApiError } from '../errors/ApiError.js';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface CreateRefundInput {
    orderId: string;
    /** Amount in paise (integer). 100 paise = ₹1 */
    amount: number;
    reason?: string;
    initiatedBy: RefundInitiator;
}

// ─────────────────────────────────────────────────────────────────
// Refund Service
//
// Architecture (concurrency-safe):
//   1. Idempotency check (read-only, outside tx)
//   2. Transaction: over-refund guard + create PENDING row
//   3. Razorpay call (outside tx — no long locks)
//   4. Optimistic update to SUCCESS or FAILED
// ─────────────────────────────────────────────────────────────────

export class RefundService {
    /**
     * Create a refund ledger entry and execute refund via payment provider.
     *
     * Rules:
     *  - Idempotent: if SUCCESS refund for same order+amount exists → returns it
     *  - Over-refund prevention: sum(SUCCESS + PENDING) + amount <= order.totalAmount (in paise)
     *  - PENDING row created inside transaction
     *  - Provider call outside transaction
     *  - Final status update uses optimistic lock (WHERE status = PENDING)
     *  - Failed records are NEVER deleted (immutable audit trail)
     */
    async createRefund(input: CreateRefundInput) {
        const { orderId, amount, reason, initiatedBy } = input;

        if (!Number.isInteger(amount) || amount <= 0) {
            throw ApiError.badRequest('Refund amount must be a positive integer (paise)');
        }

        // ── 1. Idempotency check ────────────────────────────────────
        const existingSuccess = await prisma.refund.findFirst({
            where: {
                orderId,
                amount,
                status: RefundStatus.SUCCESS,
            },
        });

        if (existingSuccess) {
            refundLogger.info(
                { orderId, refundId: existingSuccess.id, amount },
                'refund_idempotent_hit',
            );
            return existingSuccess;
        }

        // ── 2. Fetch order + payment ────────────────────────────────
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                totalAmount: true,
                payment: {
                    select: {
                        id: true,
                        status: true,
                        provider: true,
                        providerPaymentId: true,
                        providerOrderId: true,
                    },
                },
            },
        });

        if (!order) {
            throw ApiError.notFound('Order not found');
        }

        if (!order.payment) {
            throw ApiError.badRequest('No payment record found for this order');
        }

        if (order.payment.status !== PaymentStatus.SUCCESS && order.payment.status !== PaymentStatus.REFUNDED) {
            throw ApiError.badRequest(`Cannot refund payment with status ${order.payment.status}`);
        }

        const paymentId = order.payment.id;
        const orderTotalPaise = Math.round(order.totalAmount * 100);

        // ── 3. Transaction: over-refund guard + create PENDING ──────
        //    Use SELECT ... FOR UPDATE on the order row to serialize
        //    concurrent refund attempts and prevent over-refund races.
        const refund = await prisma.$transaction(async (tx) => {
            // Lock the order row to serialize concurrent refund attempts.
            // Without this, two concurrent requests under READ COMMITTED could
            // both pass the aggregate check and both create PENDING rows.
            await tx.$queryRawUnsafe(
                `SELECT id FROM "orders" WHERE id = $1 FOR UPDATE`,
                orderId,
            );

            // Sum of all non-FAILED refunds for this order
            const aggregate = await tx.refund.aggregate({
                where: {
                    orderId,
                    status: { not: RefundStatus.FAILED },
                },
                _sum: { amount: true },
            });

            const alreadyRefundedPaise = aggregate._sum.amount ?? 0;

            if (alreadyRefundedPaise + amount > orderTotalPaise) {
                refundOverLimitRejectedTotal.inc();
                refundLogger.warn(
                    { orderId, requestedAmount: amount, alreadyRefunded: alreadyRefundedPaise, orderTotal: orderTotalPaise },
                    'refund_over_limit_rejected',
                );
                throw ApiError.badRequest(
                    `Refund exceeds order total. Already refunded: ${alreadyRefundedPaise} paise, requested: ${amount} paise, limit: ${orderTotalPaise} paise`,
                );
            }

            const newRefund = await tx.refund.create({
                data: {
                    orderId,
                    paymentId,
                    amount,
                    reason: reason ?? null,
                    status: RefundStatus.PENDING,
                    initiatedBy,
                },
            });

            return newRefund;
        });

        refundCreatedTotal.inc();
        refundLogger.info(
            { orderId, refundId: refund.id, amount, initiatedBy },
            'refund_pending_created',
        );

        // ── 4. Call the payment provider (outside tx) ───────────────
        // A refund can only proceed once the payment was actually collected.
        // razorpayRefundId is the historical column name; it stores the
        // provider refund id (PhonePe) or a manual marker.
        let razorpayRefundId: string | null = null;
        let providerSuccess = false;

        if (
            order.payment.status !== PaymentStatus.SUCCESS
            && order.payment.status !== PaymentStatus.REFUNDED
        ) {
            refundLogger.warn(
                { orderId, refundId: refund.id, paymentStatus: order.payment.status },
                'refund_before_collection',
            );
            providerSuccess = false;
        } else if (
            order.payment.provider === PaymentProvider.PHONEPE
            && order.payment.providerOrderId
            && isPhonePeConfigured()
        ) {
            try {
                const ppRefund = await phonepeService.initiateRefund(
                    `rf_${refund.id}`,
                    order.payment.providerOrderId,
                    amount / 100, // paise → rupees
                );
                razorpayRefundId = ppRefund.refundId ?? null;
                providerSuccess = true;
            } catch (error: any) {
                refundLogger.error(
                    { orderId, refundId: refund.id, error: error?.message },
                    'phonepe_refund_api_failed',
                );
                providerSuccess = false;
            }
        } else if (
            order.payment.provider === PaymentProvider.FASTRR
            && order.payment.providerOrderId
            && isFastrrConfigured()
        ) {
            // Shiprocket brokered the gateway, so they own the refund too — we
            // hold no gateway handle we could refund against ourselves. Falling
            // through to the manual branch below would mark the ledger refunded
            // while no money actually moved, so this must be an explicit case.
            try {
                await initiateFastrrRefund(
                    order.payment.providerOrderId,
                    amount / 100, // paise → rupees
                );
                // Fastrr queues refunds asynchronously and reports the outcome in
                // their refund report; the ledger entry records the order it was
                // raised against.
                razorpayRefundId = `fastrr_${order.payment.providerOrderId}_${refund.id}`;
                providerSuccess = true;
            } catch (error: any) {
                refundLogger.error(
                    { orderId, refundId: refund.id, error: error?.message },
                    'fastrr_refund_api_failed',
                );
                providerSuccess = false;
            }
        } else {
            // No provider attempt on record — settle the ledger manually.
            razorpayRefundId = `manual_refund_${refund.id}`;
            providerSuccess = true;
        }

        // ── 5. Optimistic update to SUCCESS or FAILED ───────────────
        if (providerSuccess) {
            const updated = await prisma.refund.updateMany({
                where: { id: refund.id, status: RefundStatus.PENDING },
                data: {
                    status: RefundStatus.SUCCESS,
                    razorpayRefundId,
                },
            });

            if (updated.count > 0) {
                refundLedgerSuccessTotal.inc();
                refundLogger.info(
                    { orderId, refundId: refund.id, razorpayRefundId, amount },
                    'refund_success',
                );

                // Also mark payment as REFUNDED if not already
                await prisma.payment.updateMany({
                    where: { id: paymentId, status: { not: PaymentStatus.REFUNDED } },
                    data: { status: PaymentStatus.REFUNDED },
                });
            }

            const result = await prisma.refund.findUnique({ where: { id: refund.id } });
            return result ?? refund;
        } else {
            await prisma.refund.updateMany({
                where: { id: refund.id, status: RefundStatus.PENDING },
                data: { status: RefundStatus.FAILED },
            });

            refundFailedTotal.inc();
            refundLogger.error(
                { orderId, refundId: refund.id, amount },
                'refund_failed',
            );

            throw new ApiError(502, `Refund failed for order ${orderId}. Ledger entry preserved for audit.`);
        }
    }

    /**
     * List all refunds (admin view).
     */
    async listRefunds(filters?: { orderId?: string; status?: RefundStatus }) {
        const refunds = await prisma.refund.findMany({
            where: {
                ...(filters?.orderId ? { orderId: filters.orderId } : {}),
                ...(filters?.status ? { status: filters.status } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                order: {
                    select: {
                        id: true,
                        totalAmount: true,
                        status: true,
                    },
                },
                payment: {
                    select: {
                        id: true,
                        provider: true,
                        providerPaymentId: true,
                    },
                },
            },
        });

        return { refunds };
    }
}

export const refundService = new RefundService();
