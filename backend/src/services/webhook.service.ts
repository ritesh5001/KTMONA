import { paymentService } from './payment.service.js';
import { PaymentEventType } from '@prisma/client';
import { ApiError } from '../errors/ApiError.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { paymentLogger } from '../config/logger.js';
import { isValidWebhookSignature, type RazorpayPayment } from './razorpay.client.js';

/** Events that can mean "this order is paid". */
const PAID_EVENTS = new Set(['payment.authorized', 'payment.captured', 'order.paid']);

export class WebhookService {

    async processWebhook(provider: string, rawBody: Buffer | undefined, payload: any, signature: string) {
        if (provider.toUpperCase() !== 'RAZORPAY') {
            throw new ApiError(400, 'Provider webhook not implemented');
        }
        await this.handleRazorpayWebhook(rawBody, payload, signature);
    }

    // ------------------------------------------------------------------
    // Razorpay webhook
    //
    // Auth: X-Razorpay-Signature = HMAC-SHA256(raw body, webhook secret).
    // Handlers are idempotent (Razorpay retries, and the Checkout return and
    // stale sweep may settle the same payment), and unmatched events are
    // acknowledged so Razorpay does not keep retrying or disable the hook.
    // ------------------------------------------------------------------

    private async handleRazorpayWebhook(rawBody: Buffer | undefined, payload: any, signature: string) {
        if (!rawBody || !isValidWebhookSignature(rawBody, signature)) {
            paymentLogger.error({ event: 'razorpay_webhook_invalid_signature' }, 'Razorpay webhook: invalid signature');
            throw new ApiError(401, 'Invalid webhook signature');
        }

        const event: string = payload?.event ?? '';
        const entity: RazorpayPayment | undefined = payload?.payload?.payment?.entity;
        paymentLogger.info(
            { event: 'razorpay_webhook_received', webhookEvent: event, razorpayOrderId: entity?.order_id, razorpayPaymentId: entity?.id },
            `Razorpay webhook received: ${event}`,
        );

        if (!entity?.order_id) {
            // refund.* and other events: logged above, nothing to settle.
            return;
        }

        const payment = await paymentRepository.findByProviderOrderId(entity.order_id);
        if (!payment) {
            paymentLogger.warn(
                { event: 'razorpay_webhook_unmatched', webhookEvent: event, razorpayOrderId: entity.order_id },
                'Razorpay webhook for an order we do not know',
            );
            return;
        }

        if (PAID_EVENTS.has(event)) {
            const outcome = await paymentService.settleRazorpayPayment(payment, entity, `webhook:${event}`);
            paymentLogger.info(
                { event: 'razorpay_webhook_processed', webhookEvent: event, orderId: payment.orderId, outcome },
                `Razorpay webhook ${event} for order ${payment.orderId}: ${outcome}`,
            );
            return;
        }

        if (event === 'payment.failed') {
            // One failed attempt does not fail the order: the buyer can try again
            // on the same Razorpay order. Keep it for the audit trail only.
            await paymentRepository.createPaymentEvent({
                paymentId: payment.id,
                type: PaymentEventType.WEBHOOK,
                payload: {
                    event,
                    razorpayPaymentId: entity.id,
                    reason: entity.error_description ?? null,
                },
            });
        }
    }
}

export const webhookService = new WebhookService();
