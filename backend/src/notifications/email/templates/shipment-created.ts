import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

export function shipmentCreatedTemplate(data: {
    orderId: string;
    carrier: string;
    trackingNumber: string;
}): EmailTemplateResult {
    return {
        subject: `Shipment Created for Order #${data.orderId}`,
        html: renderBrandedEmail({
            preheader: `A shipment has been created for order #${data.orderId}.`,
            eyebrow: 'Shipment Created',
            title: 'Your Shipment Is Being Prepared',
            message: [
                'Good news. Your seller has created the shipment record for your order.',
                'You can view the shipment details below. A shipped update will follow once the parcel is handed to the carrier.',
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
