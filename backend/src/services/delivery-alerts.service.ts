/**
 * Delivery alerts for buyers: out for delivery, a failed delivery attempt, and
 * a parcel running past its estimated delivery date. Sent as in-app + email
 * (the email respects the buyer's notification preferences); each alert goes
 * out once per shipment thanks to its event key.
 */

import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { notificationService } from '../notifications/notification.service.js';

const log = logger.child({ module: 'delivery-alerts' });

const OUT_FOR_DELIVERY = /out\s*for\s*delivery|\bofd\b/i;
const FAILED_ATTEMPT = /undeliver|not\s*deliver|delivery\s*(attempt|failed)|\bndr\b|customer\s*(not\s*available|unavailable|refused)|refused|address\s*(issue|incomplete|not\s*found)|door\s*locked|reschedul/i;

/** Matches the latest estimate shown on the order page (dispatch + 5 days). */
const LATE_AFTER_SHIPPED_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function shortId(orderId: string) {
    return orderId.slice(0, 8).toUpperCase();
}

/** Called when the courier's status text for a shipment changes. */
export async function alertOnCourierStatus(shipment: { id: string; order_id: string }, courierStatus: string): Promise<void> {
    const kind = OUT_FOR_DELIVERY.test(courierStatus) ? 'OFD' : FAILED_ATTEMPT.test(courierStatus) ? 'ATTEMPT' : null;
    if (!kind) return;

    const order = await prisma.order.findUnique({ where: { id: shipment.order_id }, select: { userId: true } });
    if (!order) return;

    const title = kind === 'OFD' ? 'Out for delivery today' : 'Delivery attempt unsuccessful';
    const message = kind === 'OFD'
        ? `Your order #${shortId(shipment.order_id)} is out for delivery. Please keep your phone reachable.`
        : `The courier could not deliver order #${shortId(shipment.order_id)} (${courierStatus}). They will try again; check your address and phone, or contact support.`;

    await notificationService.create({
        userId: order.userId,
        role: 'USER',
        type: 'ORDER_UPDATE',
        channel: 'EMAIL',
        content: title,
        metadata: { orderId: shipment.order_id, title, message, courierStatus },
        // One OFD alert per shipment; attempts are keyed by day so a second failed day alerts again.
        eventKey: kind === 'OFD'
            ? `DELIVERY_OFD:${shipment.id}`
            : `DELIVERY_ATTEMPT:${shipment.id}:${new Date().toISOString().slice(0, 10)}`,
    });
}

/** Maintenance sweep: tell buyers once when a shipped parcel is past its estimate. */
export async function notifyDelayedShipments(): Promise<number> {
    const cutoff = new Date(Date.now() - LATE_AFTER_SHIPPED_DAYS * DAY_MS);
    const late = await prisma.shipments.findMany({
        where: { status: 'SHIPPED', shipped_at: { lt: cutoff }, delay_notified_at: null },
        select: { id: true, order_id: true, orders: { select: { userId: true } } },
        take: 200,
    });

    for (const s of late) {
        try {
            const title = 'Your delivery is running late';
            await notificationService.create({
                userId: s.orders.userId,
                role: 'USER',
                type: 'ORDER_UPDATE',
                channel: 'EMAIL',
                content: title,
                metadata: {
                    orderId: s.order_id,
                    title,
                    message: `Order #${shortId(s.order_id)} is taking longer than expected. It is still on its way and we are following up with the courier. Sorry for the wait.`,
                },
                eventKey: `DELIVERY_DELAYED:${s.id}`,
            });
            await prisma.shipments.update({ where: { id: s.id }, data: { delay_notified_at: new Date() } });
        } catch (err) {
            log.warn({ err: err instanceof Error ? err.message : String(err), shipmentId: s.id }, 'delay_notice_failed');
        }
    }
    if (late.length) log.info({ count: late.length }, 'Delay notices sent');
    return late.length;
}
