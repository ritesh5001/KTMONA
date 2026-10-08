import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';
export function orderDeliveredTemplate(data) {
    return {
        subject: `Order #${data.orderId} Delivered`,
        html: renderBrandedEmail({
            preheader: `Order #${data.orderId} has been delivered successfully.`,
            eyebrow: 'Delivery Confirmation',
            title: 'Delivered Successfully',
            message: [
                'Your order has been delivered to the provided shipping address.',
                'We hope your Tatvivah purchase adds elegance to your special occasion.',
            ],
            details: [{ label: 'Order ID', value: data.orderId }],
            ctaLabel: 'View Order',
            ctaUrl: portalLinks.userOrders,
            accentText: 'If anything is incorrect with this delivery, please contact support promptly.',
        }),
    };
}
//# sourceMappingURL=order-delivered.js.map