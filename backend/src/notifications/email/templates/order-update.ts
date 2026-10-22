import { EmailTemplateResult } from '../../types.js';
import { renderBrandedEmail } from './layout.js';
import { portalLinks } from './portal-links.js';

/**
 * Any customer-facing order update that has no dedicated template: out for
 * delivery, a failed delivery attempt, a delay, return pickup, replacement sent,
 * a declined cancellation or return.
 */
export function orderUpdateTemplate(data: { title?: string; message?: string; orderId?: string; content?: string }): EmailTemplateResult {
    const title = data.title ?? data.content ?? 'Update on your order';
    const message = data.message ?? data.content ?? title;
    const orderUrl = data.orderId ? `${portalLinks.userOrders}/${data.orderId}` : portalLinks.userOrders;
    return {
        subject: data.orderId ? `${title} · Order #${data.orderId.slice(0, 8).toUpperCase()}` : title,
        html: renderBrandedEmail({
            preheader: message,
            eyebrow: 'Order Update',
            title,
            message: [message],
            details: data.orderId ? [{ label: 'Order ID', value: data.orderId.slice(0, 8).toUpperCase() }] : [],
            ctaLabel: 'View Order',
            ctaUrl: orderUrl,
            accentText: 'You can change which updates you receive in My Account → Notification Preferences.',
        }),
    };
}
