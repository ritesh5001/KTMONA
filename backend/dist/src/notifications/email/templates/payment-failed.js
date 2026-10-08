import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';
export function paymentFailedTemplate(data) {
    return {
        subject: `Payment Failed for Order #${data.orderId}`,
        html: renderBrandedEmail({
            preheader: `Payment attempt failed for order #${data.orderId}.`,
            eyebrow: 'Payment Action Needed',
            title: 'Payment Could Not Be Processed',
            message: [
                'We were unable to complete the payment for your order.',
                'Please retry with the same method or choose an alternate payment option. The order will remain reserved for a limited window.',
            ],
            details: [{ label: 'Order ID', value: data.orderId }],
            ctaLabel: 'Retry Payment',
            ctaUrl: portalLinks.userOrders,
            accentText: 'If your account was charged but status remains failed, contact support with this order ID.',
        }),
    };
}
//# sourceMappingURL=payment-failed.js.map