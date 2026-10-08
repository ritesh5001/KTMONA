import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

export function orderShippedTemplate(data: { orderId: string, trackingNumber: string, carrier: string }): EmailTemplateResult {
    return {
        subject: `Your Order #${data.orderId} has Shipped!`,
        html: renderBrandedEmail({
            preheader: `Order #${data.orderId} has been shipped.`,
            eyebrow: 'Shipment Update',
            title: 'Your Order Is On The Way',
            message: [
                'Your parcel has been handed over to our delivery partner and is now in transit.',
                'Use the shipment details below to track movement with the carrier.',
            ],
            details: [
                { label: 'Order ID', value: data.orderId },
                { label: 'Carrier', value: data.carrier },
                { label: 'Tracking Number', value: data.trackingNumber },
            ],
            ctaLabel: 'View Order Status',
            ctaUrl: portalLinks.userOrders,
        }),
    };
}
