
import { paymentService } from './payment.service.js';
import { PaymentProvider, PaymentStatus, PaymentEventType } from '@prisma/client';
import { ApiError } from '../errors/ApiError.js';
import { phonepeService } from './phonepe.service.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { prisma } from '../config/db.js';
import { paymentLogger } from '../config/logger.js';
import { env } from '../config/env.js';
import { fastrrOrderService } from './fastrr-order.service.js';

export class WebhookService {

    async processWebhook(provider: string, payload: any, signature: string, apiKey?: string) {
        const p = provider.toUpperCase();

        if (p === PaymentProvider.PHONEPE) {
            await this.handlePhonePeWebhook(payload, signature);
            return;
        }

        if (p === PaymentProvider.FASTRR) {
            await this.handleFastrrWebhook(payload, apiKey);
            return;
        }

        throw new ApiError(400, 'Provider webhook not implemented');
    }

    // ------------------------------------------------------------------
    // Shiprocket Checkout (Fastrr) order webhook
    //
    // Shiprocket does not document signing this callback, so the body is treated
    // as a bare notification and nothing in it is trusted: the only field read is
    // `order_id`, and every fact about the order is then re-fetched from their
    // Order/Details API. That makes a forged POST at worst a wasted lookup.
    //
    // Their docs also warn the same webhook may be delivered more than once, so
    // the handler is idempotent by construction (see fastrr-order.service.ts).
    // ------------------------------------------------------------------

    private async handleFastrrWebhook(payload: any, apiKey?: string) {
        // Optional second gate. Off unless FASTRR_WEBHOOK_API_KEY is configured,
        // because requiring a header Shiprocket may not send would silently drop
        // every real order.
        const expectedKey = env.FASTRR_WEBHOOK_API_KEY?.trim();
        if (expectedKey && apiKey?.trim() !== expectedKey) {
            paymentLogger.error({ event: 'fastrr_webhook_invalid_key' }, 'Fastrr webhook: invalid API key');
            throw new ApiError(401, 'Invalid webhook credentials');
        }

        const fastrrOrderId = payload?.order_id;
        if (!fastrrOrderId || typeof fastrrOrderId !== 'string') {
            paymentLogger.error({ event: 'fastrr_webhook_missing_order' }, 'Fastrr webhook: missing order_id');
            return;
        }

        paymentLogger.info(
            {
                event: 'fastrr_webhook_received',
                fastrrOrderId,
                // Logged for support only — never used to decide anything.
                reportedStatus: payload?.status,
            },
            `Fastrr webhook received for order ${fastrrOrderId}`,
        );

        const result = await fastrrOrderService.syncFromFastrr(fastrrOrderId, 'webhook');

        paymentLogger.info(
            { event: 'fastrr_webhook_processed', fastrrOrderId, status: result.status, orderId: result.orderId },
            `Fastrr webhook for ${fastrrOrderId}: ${result.status}`,
        );
    }

    // ------------------------------------------------------------------
    // PhonePe webhook
    //
    // Auth: PhonePe sends Authorization: SHA256(username:password). The webhook
    // is a hint — success is re-confirmed via the Order Status API before we
    // mark the payment SUCCESS.
    // ------------------------------------------------------------------

    private async handlePhonePeWebhook(payload: any, authorizationHeader: string) {
        if (!phonepeService.verifyWebhookAuthorization(authorizationHeader)) {
            paymentLogger.error({ event: 'phonepe_webhook_invalid_auth' }, 'PhonePe webhook: invalid authorization');
            throw new ApiError(401, 'Invalid webhook authorization');
        }

        const event = phonepeService.parseWebhookEvent(payload);
        paymentLogger.info(
            { event: 'phonepe_webhook_received', webhookEvent: event.event, merchantOrderId: event.merchantOrderId },
            `PhonePe webhook received: ${event.event}`,
        );

        if (!event.event.startsWith('checkout.order.')) {
            paymentLogger.info(
                { event: 'phonepe_webhook_unhandled', webhookEvent: event.event },
                `PhonePe webhook unhandled event: ${event.event}`,
            );
            return;
        }

        if (!event.merchantOrderId) {
            paymentLogger.error({ event: 'phonepe_webhook_missing_order' }, 'PhonePe webhook: missing merchantOrderId');
            return;
        }

        let payment = await paymentRepository.findByProviderOrderId(event.merchantOrderId);

        if (!payment) {
            // Payment.providerOrderId holds only the LATEST attempt's merchantOrderId,
            // so a webhook for an earlier attempt finds nothing. That is a money-loss
            // path: a buyer who completes attempt #1 after opening attempt #2 would
            // never have their order confirmed, and the stale-order sweep would cancel
            // a paid order. Recover the order from the merchantOrderId prefix.
            const derivedOrderId = phonepeService.parseOrderIdFromMerchantOrderId(event.merchantOrderId);
            if (derivedOrderId) {
                const candidate = await paymentRepository.findPaymentByOrderId(derivedOrderId);
                if (candidate && candidate.provider === PaymentProvider.PHONEPE) {
                    payment = candidate;
                    paymentLogger.info(
                        {
                            event: 'phonepe_webhook_matched_by_prefix',
                            merchantOrderId: event.merchantOrderId,
                            orderId: derivedOrderId,
                            paymentId: candidate.id,
                            currentProviderOrderId: candidate.providerOrderId,
                        },
                        `PhonePe webhook: matched superseded attempt ${event.merchantOrderId} to order ${derivedOrderId}`,
                    );
                }
            }
        }

        if (!payment) {
            // Expected for orders that were never created through this app (e.g.
            // direct API tests on the same merchant account). Not an app error —
            // we acknowledge the webhook and skip it.
            paymentLogger.warn(
                { event: 'phonepe_webhook_payment_not_found', merchantOrderId: event.merchantOrderId },
                `PhonePe webhook: no local payment for ${event.merchantOrderId} — skipping`,
            );
            return;
        }

        if (payment.status === PaymentStatus.SUCCESS) {
            return; // idempotent
        }

        await prisma.paymentEvent.create({
            data: { paymentId: payment.id, type: PaymentEventType.WEBHOOK, payload: payload as any },
        });

        if (event.event === 'checkout.order.completed' && event.state === 'COMPLETED') {
            // Re-confirm with the status API before trusting the webhook.
            const status = await phonepeService.getOrderStatus(event.merchantOrderId);
            if (status.state !== 'COMPLETED') {
                paymentLogger.warn(
                    { event: 'phonepe_webhook_state_mismatch', merchantOrderId: event.merchantOrderId, state: status.state },
                    'PhonePe webhook: status API disagrees with webhook, skipping',
                );
                return;
            }
            const transactionId =
                status.paymentDetails?.[0]?.transactionId ?? event.transactionId ?? status.orderId;

            await paymentService.handlePaymentSuccess(
                payment.id,
                payment.orderId,
                transactionId,
                { merchantOrderId: event.merchantOrderId, phonepeOrderId: status.orderId, source: 'webhook' },
            );
            return;
        }

        if (event.event === 'checkout.order.failed') {
            if (payment.status === PaymentStatus.FAILED) return;

            // Only the CURRENT attempt may fail the payment. A failure webhook for a
            // superseded attempt (buyer abandoned it and started a retry) must not kill
            // the retry that is still in flight — or worse, one that already succeeded.
            if (payment.providerOrderId !== event.merchantOrderId) {
                paymentLogger.info(
                    {
                        event: 'phonepe_webhook_stale_failure_ignored',
                        merchantOrderId: event.merchantOrderId,
                        currentProviderOrderId: payment.providerOrderId,
                        paymentId: payment.id,
                    },
                    `PhonePe webhook: ignoring failure for superseded attempt ${event.merchantOrderId}`,
                );
                return;
            }

            await paymentService.handlePaymentFailure(payment.id, {
                merchantOrderId: event.merchantOrderId,
                source: 'webhook',
            });
        }
    }
}

export const webhookService = new WebhookService();
