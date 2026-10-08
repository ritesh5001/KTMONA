import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';
export function paymentSuccessTemplate(data) {
    return {
        subject: `Payment Confirmed for Order #${data.orderId}`,
        html: renderBrandedEmail({
            preheader: `Payment for order #${data.orderId} has been received.`,
            eyebrow: 'Payment Update',
            title: 'Payment Successful',
            message: [
                'Your payment has been received and verified successfully.',
                'The order is now in processing and will move to shipment soon.',
            ],
            details: [
                { label: 'Order ID', value: data.orderId },
                { label: 'Amount Paid', value: `INR ${Number(data.amount).toLocaleString('en-IN')}` },
            ],
            ctaLabel: 'Open My Orders',
            ctaUrl: portalLinks.userOrders,
        }),
    };
}
//# sourceMappingURL=payment-success.js.map