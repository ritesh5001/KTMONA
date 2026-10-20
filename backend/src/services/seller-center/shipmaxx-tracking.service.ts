/**
 * ShipMaxx has no webhooks, so the maintenance sweep polls tracking for
 * ShipMaxx shipments still on the move and walks them through our states:
 * CREATED → SHIPPED → DELIVERED, or SHIPPED → RTO_INITIATED → RTO_DELIVERED.
 */

import type { ShipmentStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { invalidateSellerPrivateCaches } from '../../utils/cache.util.js';
import { shipmentService } from '../shipment.service.js';
import { sellerOrdersService } from './orders.service.js';
import { isShipmaxxShippingEnabled, trackShipment } from './shipmaxx.client.js';

const log = logger.child({ module: 'shipmaxx-tracking' });

/**
 * Per sweep. Calls are made one at a time (about 2 a second), so this bounds
 * the sweep to roughly a minute and leaves room for bookings in between.
 */
const BATCH = 100;
/** A shipment polled more recently than this is skipped. */
const RESYNC_MS = 20 * 60_000;

const ACTIVE: ShipmentStatus[] = ['CREATED', 'SHIPPED', 'RTO_INITIATED'];

/** Our status for a courier status text, or null when it does not move the shipment. */
export function mapCourierStatus(text: string): Exclude<ShipmentStatus, 'CREATED'> | null {
    const s = text.toLowerCase();
    const rto = /\brto\b|return(ed|ing)? to origin|return to seller/.test(s);
    if (rto) return /deliver|received/.test(s) ? 'RTO_DELIVERED' : 'RTO_INITIATED';
    if (/cancel|lost|damage/.test(s)) return null;
    if (/deliver/.test(s) && !/undeliver|not deliver|out for delivery|failed/.test(s)) return 'DELIVERED';
    if (/pick(ed)?\s*up|in[\s-]?transit|shipped|dispatch|out for delivery|reached|arrived|hub|undeliver|ndr/.test(s)) {
        return /pickup (scheduled|pending|requested)|not picked/.test(s) ? null : 'SHIPPED';
    }
    return null;
}

async function apply(shipment: { id: string; order_id: string; seller_id: string; status: ShipmentStatus }, target: Exclude<ShipmentStatus, 'CREATED'>, note: string) {
    let status = shipment.status;
    const step = async (next: ShipmentStatus) => {
        if (next === 'RTO_INITIATED') await sellerOrdersService.rto(shipment.seller_id, shipment.order_id, 'initiated', note);
        else if (next === 'RTO_DELIVERED') await sellerOrdersService.rto(shipment.seller_id, shipment.order_id, 'received');
        else await shipmentService.updateStatus(shipment.id, shipment.seller_id, next, note);
        status = next;
    };
    if (status === 'CREATED') await step('SHIPPED');
    if (target === 'DELIVERED' && status === 'SHIPPED') await step('DELIVERED');
    if ((target === 'RTO_INITIATED' || target === 'RTO_DELIVERED') && status === 'SHIPPED') await step('RTO_INITIATED');
    if (target === 'RTO_DELIVERED' && status === 'RTO_INITIATED') await step('RTO_DELIVERED');
    return status !== shipment.status;
}

/** Poll one batch; returns how many shipments changed state. */
export async function syncShipmaxxTracking(): Promise<number> {
    if (!isShipmaxxShippingEnabled()) return 0;
    const base = { fulfillment_mode: 'SHIPMAXX' as const, status: { in: ACTIVE }, NOT: { tracking_number: '' } };
    const select = { id: true, order_id: true, seller_id: true, status: true, tracking_number: true, courier_status: true };
    // Never-polled shipments first, then the stalest.
    const fresh = await prisma.shipments.findMany({ where: { ...base, tracking_synced_at: null }, select, orderBy: { created_at: 'asc' }, take: BATCH });
    const stale =
        fresh.length < BATCH
            ? await prisma.shipments.findMany({
                  where: { ...base, tracking_synced_at: { lt: new Date(Date.now() - RESYNC_MS) } },
                  select,
                  orderBy: { tracking_synced_at: 'asc' },
                  take: BATCH - fresh.length,
              })
            : [];

    let changed = 0;
    for (const shipment of [...fresh, ...stale]) {
        try {
            const tracking = await trackShipment(shipment.tracking_number);
            const text = tracking.currentStatus ?? tracking.history.at(-1)?.status ?? null;
            const target = text ? mapCourierStatus(text) : null;
            const moved = target ? await apply(shipment, target, `Courier: ${text}`) : false;
            await prisma.shipments.update({
                where: { id: shipment.id },
                data: { courier_status: text, tracking_synced_at: new Date() },
            });
            if (moved || text !== shipment.courier_status) await invalidateSellerPrivateCaches(shipment.seller_id);
            if (moved) changed += 1;
        } catch (err) {
            log.warn({ err: err instanceof Error ? err.message : String(err), shipmentId: shipment.id }, 'tracking_sync_failed');
            // Push it to the back of the queue rather than retrying it every sweep first.
            await prisma.shipments
                .update({ where: { id: shipment.id }, data: { tracking_synced_at: new Date() } })
                .catch(() => undefined);
        }
    }
    if (changed) log.info({ changed }, 'ShipMaxx tracking applied');
    return changed;
}
