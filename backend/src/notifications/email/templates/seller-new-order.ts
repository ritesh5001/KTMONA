import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

export function sellerNewOrderTemplate(data: { orderId: string, itemsCount: number }): EmailTemplateResult {
    return {
        subject: `New Order Received #${data.orderId}`,
        html: renderBrandedEmail({
            preheader: `A new order #${data.orderId} has been assigned to your store.`,
            eyebrow: 'Seller Notification',
            title: 'New Order Received',
            message: [
                'Your store has received a new confirmed order.',
                'Please begin packing and dispatch workflow from your seller dashboard.',
            ],
            details: [
                { label: 'Order ID', value: data.orderId },
                { label: 'Items', value: data.itemsCount },
            ],
            ctaLabel: 'Open Seller Orders',
            ctaUrl: portalLinks.sellerOrders,
        }),
    };
}
