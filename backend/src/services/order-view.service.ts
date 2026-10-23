/**
 * Buyer order view: everything the "Order details" screen shows beyond the raw
 * order row — the delivery timeline, per-seller shipment tracking (courier,
 * AWB, tracking link, delivery attempts, estimated date), the charges breakup,
 * refunds, return/replacement requests and what the buyer can still do
 * (cancel, return, replace).
 */

import type { OrderStatus, ShipmentStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { RETURN_WINDOW_DAYS } from './return.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Delivery estimate in days from the reference point (dispatch, or order). */
const ETA_AFTER_SHIPPED = { min: 2, max: 5 };
const ETA_AFTER_ORDER = { min: 4, max: 8 };

export type TrackingStageKey =
    | 'PLACED'
    | 'CONFIRMED'
    | 'PACKED'
    | 'SHIPPED'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'DELIVERY_FAILED';

export interface TrackingStage {
    key: TrackingStageKey;
    label: string;
    at: string | null;
    done: boolean;
    current: boolean;
}

const STAGE_LABELS: Record<TrackingStageKey, string> = {
    PLACED: 'Order placed',
    CONFIRMED: 'Seller confirmed',
    PACKED: 'Packed',
    SHIPPED: 'Shipped',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    DELIVERY_FAILED: 'Delivery failed',
};

const OUT_FOR_DELIVERY = /out\s*for\s*delivery|\bofd\b/i;
const FAILED_ATTEMPT = /undeliver|not\s*deliver|delivery\s*(attempt|failed)|\bndr\b|customer\s*(not\s*available|unavailable|refused)|refused|address\s*(issue|incomplete|not\s*found)|door\s*locked|reschedul/i;

/** Public tracking page for a courier's AWB, when we know the courier's URL format. */
export function courierTrackingUrl(carrier: string, awb: string, viaShiprocket: boolean): string | null {
    if (!awb) return null;
    const code = encodeURIComponent(awb);
    const c = carrier.toLowerCase();
    if (c.includes('delhivery')) return `https://www.delhivery.com/track/package/${code}`;
    if (c.includes('xpressbees') || c.includes('xpress bees')) return `https://www.xpressbees.com/shipment/tracking?awbNo=${code}`;
    if (c.includes('ekart')) return `https://ekartlogistics.com/shipmenttrack/${code}`;
    if (c.includes('ecom')) return `https://ecomexpress.in/tracking/?awb_field=${code}`;
    if (c.includes('blue dart') || c.includes('bluedart')) return `https://www.bluedart.com/tracking?trackFor=0&trackNo=${code}`;
    if (c.includes('dtdc')) return `https://www.dtdc.in/trace.asp?strCnno=${code}`;
    if (c.includes('shadowfax')) return `https://tracker.shadowfax.in/#/track/${code}`;
    if (viaShiprocket || c.includes('shiprocket')) return `https://shiprocket.co/tracking/${code}`;
    return null;
}

type ShipmentRow = {
    id: string;
    seller_id: string;
    carrier: string;
    tracking_number: string;
    status: ShipmentStatus;
    fulfillment_mode: string;
    courier_status: string | null;
    created_at: Date;
    shipped_at: Date | null;
    delivered_at: Date | null;
    label_generated_at: Date | null;
    manifested_at: Date | null;
    packet_scanned_at: Date | null;
    rto_initiated_at: Date | null;
    rto_reason: string | null;
    shipment_events: Array<{ status: ShipmentStatus; note: string | null; created_at: Date }>;
};

function iso(d: Date | null | undefined): string | null {
    return d ? d.toISOString() : null;
}

function addDays(d: Date, days: number): Date {
    return new Date(d.getTime() + days * DAY_MS);
}

/** Stage timestamps for one shipment (or for an order with no shipment yet). */
function shipmentStages(orderCreatedAt: Date, s: ShipmentRow | null, cancelledAt: Date | null): TrackingStage[] {
    const outForDelivery = s?.courier_status && OUT_FOR_DELIVERY.test(s.courier_status) ? s.courier_status : null;
    const ofdEvent = s?.shipment_events.find((e) => e.note && OUT_FOR_DELIVERY.test(e.note));
    const delivered = s?.status === 'DELIVERED';
    const failed = s?.status === 'RTO_INITIATED' || s?.status === 'RTO_DELIVERED';

    const raw: Array<[TrackingStageKey, Date | null, boolean]> = [
        ['PLACED', orderCreatedAt, true],
        ['CONFIRMED', s?.created_at ?? null, Boolean(s)],
        ['PACKED', s?.label_generated_at ?? s?.manifested_at ?? s?.packet_scanned_at ?? null, Boolean(s && (s.label_generated_at || s.manifested_at || s.packet_scanned_at || s.shipped_at))],
        ['SHIPPED', s?.shipped_at ?? null, Boolean(s?.shipped_at) || delivered || failed],
        ['OUT_FOR_DELIVERY', ofdEvent?.created_at ?? null, Boolean(outForDelivery || ofdEvent) || delivered],
        ['DELIVERED', s?.delivered_at ?? null, delivered],
    ];

    let stages = raw.map(([key, at, done]) => ({ key, label: STAGE_LABELS[key], at: iso(at), done, current: false }));

    if (cancelledAt && !delivered) {
        // Keep what happened, then end on Cancelled.
        stages = stages.filter((st) => st.done && st.key !== 'DELIVERED');
        stages.push({ key: 'CANCELLED', label: STAGE_LABELS.CANCELLED, at: iso(cancelledAt), done: true, current: true });
        return stages;
    }
    if (failed) {
        stages = stages.filter((st) => st.done && st.key !== 'DELIVERED');
        stages.push({ key: 'DELIVERY_FAILED', label: STAGE_LABELS.DELIVERY_FAILED, at: iso(s?.rto_initiated_at), done: true, current: true });
        return stages;
    }

    const lastDone = stages.map((st) => st.done).lastIndexOf(true);
    if (lastDone >= 0) stages[lastDone]!.current = true;
    return stages;
}

function estimateDelivery(orderCreatedAt: Date, s: ShipmentRow | null): { from: string; to: string } | null {
    if (!s) {
        return { from: iso(addDays(orderCreatedAt, ETA_AFTER_ORDER.min))!, to: iso(addDays(orderCreatedAt, ETA_AFTER_ORDER.max))! };
    }
    if (s.status !== 'CREATED' && s.status !== 'SHIPPED') return null;
    const base = s.shipped_at ?? s.created_at;
    const window = s.shipped_at ? ETA_AFTER_SHIPPED : ETA_AFTER_ORDER;
    return { from: iso(addDays(base, window.min))!, to: iso(addDays(base, window.max))! };
}

export interface BuyerOrderExtras {
    timeline: TrackingStage[];
    estimatedDelivery: { from: string; to: string } | null;
    shipments: Array<{
        id: string;
        sellerId: string;
        carrier: string;
        trackingNumber: string;
        trackingUrl: string | null;
        status: ShipmentStatus;
        courierStatus: string | null;
        /** Latest failed delivery attempt reported by the courier, if any. */
        deliveryAttempt: { failed: true; note: string } | null;
        shippedAt: string | null;
        deliveredAt: string | null;
        estimatedDelivery: { from: string; to: string } | null;
        stages: TrackingStage[];
        events: Array<{ status: ShipmentStatus; note: string | null; at: string }>;
        /** Order item ids in this parcel. */
        itemIds: string[];
    }>;
    charges: {
        itemsTotal: number;
        mrpTotal: number;
        productDiscount: number;
        couponCode: string | null;
        couponDiscount: number;
        /** Welcome offer / referral bonus. */
        autoDiscount: number;
        autoDiscountLabel: string | null;
        /** Paid from the cashback wallet. */
        walletAmount: number;
        /** Product GST (platform fee excluded). */
        tax: number;
        /** KTMONA platform fee. */
        platformFee: number;
        shipping: number;
        total: number;
    };
    refunds: Array<{ id: string; amount: number; status: string; reference: string | null; createdAt: string; updatedAt: string }>;
    returns: Array<{
        id: string;
        type: 'RETURN' | 'REPLACEMENT';
        status: string;
        reason: string;
        reasonCode: string | null;
        images: string[];
        refundAmount: number | null;
        rejectionReason: string | null;
        pickupStatus: string | null;
        pickupDate: string | null;
        pickupCarrier: string | null;
        pickupTracking: string | null;
        replacementTracking: string | null;
        appealNote: string | null;
        appealedAt: string | null;
        createdAt: string;
        items: Array<{ orderItemId: string; quantity: number }>;
    }>;
    cancellation: { status: string; reason: string; rejectionReason: string | null; createdAt: string } | null;
    eligibility: {
        cancel: { allowed: boolean; reason: string | null };
        return: { allowed: boolean; reason: string | null; windowEndsAt: string | null };
    };
}

export async function buildBuyerOrderExtras(order: {
    id: string;
    status: OrderStatus;
    createdAt: Date;
    totalAmount: number;
    subTotalAmount: number;
    totalTaxAmount: number;
    grandTotal: number;
    couponCode?: string | null;
    discountAmount?: unknown;
    autoDiscountAmount?: number | null;
    autoDiscountLabel?: string | null;
    walletAmount?: number | null;
    platformFeeAmount?: number | null;
    items: Array<{ id: string; sellerId: string; productId: string; variantId: string; quantity: number; priceSnapshot: number }>;
}): Promise<BuyerOrderExtras> {
    const [shipments, refunds, returns, cancellation, variants, products] = await Promise.all([
        prisma.shipments.findMany({
            where: { order_id: order.id },
            select: {
                id: true,
                seller_id: true,
                carrier: true,
                tracking_number: true,
                status: true,
                fulfillment_mode: true,
                courier_status: true,
                created_at: true,
                shipped_at: true,
                delivered_at: true,
                label_generated_at: true,
                manifested_at: true,
                packet_scanned_at: true,
                rto_initiated_at: true,
                rto_reason: true,
                shipment_events: { select: { status: true, note: true, created_at: true }, orderBy: { created_at: 'asc' } },
            },
            orderBy: { created_at: 'asc' },
        }),
        prisma.refund.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' } }),
        prisma.returnRequest.findMany({ where: { orderId: order.id }, include: { items: true }, orderBy: { createdAt: 'desc' } }),
        prisma.cancellationRequest.findUnique({ where: { orderId: order.id } }),
        prisma.productVariant.findMany({
            where: { id: { in: order.items.map((i) => i.variantId) } },
            select: { id: true, compareAtPrice: true },
        }),
        prisma.product.findMany({
            where: { id: { in: order.items.map((i) => i.productId) } },
            select: { id: true, isReturnable: true },
        }),
    ]);

    const cancelledAt = order.status === 'CANCELLED' ? (cancellation?.reviewedAt ?? cancellation?.updatedAt ?? null) : null;
    const cancelledFallback = order.status === 'CANCELLED' ? (cancelledAt ?? order.createdAt) : null;

    const shipmentViews = shipments.map((s) => {
        const attempt = s.courier_status && FAILED_ATTEMPT.test(s.courier_status) && s.status !== 'DELIVERED'
            ? { failed: true as const, note: s.courier_status }
            : null;
        return {
            id: s.id,
            sellerId: s.seller_id,
            carrier: s.carrier,
            trackingNumber: s.tracking_number,
            trackingUrl: courierTrackingUrl(s.carrier, s.tracking_number, s.fulfillment_mode === 'SHIPROCKET'),
            status: s.status,
            courierStatus: s.courier_status,
            deliveryAttempt: attempt,
            shippedAt: iso(s.shipped_at),
            deliveredAt: iso(s.delivered_at),
            estimatedDelivery: order.status === 'CANCELLED' ? null : estimateDelivery(order.createdAt, s),
            stages: shipmentStages(order.createdAt, s, cancelledFallback),
            events: s.shipment_events.map((e) => ({ status: e.status, note: e.note, at: e.created_at.toISOString() })),
            itemIds: order.items.filter((i) => i.sellerId === s.seller_id).map((i) => i.id),
        };
    });

    // Order-level timeline follows the slowest parcel; sellers yet to accept count as "not shipped".
    const sellers = new Set(order.items.map((i) => i.sellerId));
    const unshippedSeller = [...sellers].some((sellerId) => !shipments.some((s) => s.seller_id === sellerId));
    const slowest = unshippedSeller
        ? null
        : shipments.reduce<ShipmentRow | null>((worst, s) => {
            const rank = (x: ShipmentRow) => (x.status === 'DELIVERED' ? 3 : x.shipped_at ? 2 : 1);
            return !worst || rank(s) < rank(worst) ? s : worst;
        }, null);
    const timeline = order.status === 'PLACED'
        ? [{ key: 'PLACED' as const, label: 'Order placed (awaiting payment)', at: iso(order.createdAt), done: true, current: true }]
        : shipmentStages(order.createdAt, slowest, cancelledFallback);
    const estimatedDelivery = order.status === 'CANCELLED' || order.status === 'DELIVERED' || order.status === 'PLACED'
        ? null
        : estimateDelivery(order.createdAt, slowest);

    // Charges: the order stores the post-coupon subtotal, tax (incl. any flat GST fee) and grand total.
    const compareAt = new Map(variants.map((v) => [v.id, v.compareAtPrice]));
    const itemsTotal = order.items.reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0);
    const mrpTotal = order.items.reduce((sum, i) => {
        const mrp = compareAt.get(i.variantId);
        return sum + (mrp != null && mrp > i.priceSnapshot ? mrp : i.priceSnapshot) * i.quantity;
    }, 0);
    const autoDiscount = Number(order.autoDiscountAmount ?? 0);
    const couponDiscount = Math.max(0, Number(order.discountAmount ?? 0) - autoDiscount);
    const walletAmount = Number(order.walletAmount ?? 0);
    const shipping = Math.max(0, Math.round((order.grandTotal - order.subTotalAmount - order.totalTaxAmount) * 100) / 100);

    // What the buyer can still do.
    const anyShipped = shipments.some((s) => s.shipped_at || s.status === 'SHIPPED' || s.status === 'DELIVERED');
    let cancelReason: string | null = null;
    if (order.status === 'CANCELLED') cancelReason = 'This order is already cancelled.';
    else if (order.status === 'DELIVERED') cancelReason = 'Delivered orders cannot be cancelled. You can request a return or replacement instead.';
    else if (anyShipped || order.status === 'SHIPPED') cancelReason = 'This order has already been shipped. You can refuse the delivery, or request a return after it arrives.';
    else if (cancellation?.status === 'REQUESTED') cancelReason = 'A cancellation request is already being reviewed.';
    else if (cancellation?.status === 'REJECTED') cancelReason = 'Your cancellation request was declined.';

    const lastDelivered = shipments
        .map((s) => s.delivered_at)
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime())[0];
    const windowEndsAt = lastDelivered ? addDays(lastDelivered, RETURN_WINDOW_DAYS) : null;
    const openReturn = returns.find((r) => ['REQUESTED', 'APPROVED', 'INSPECTING'].includes(r.status));
    let returnReason: string | null = null;
    if (order.status !== 'DELIVERED') returnReason = 'Returns open once the order is delivered.';
    else if (!windowEndsAt) returnReason = 'Delivery date not available yet.';
    else if (Date.now() > windowEndsAt.getTime()) returnReason = `The ${RETURN_WINDOW_DAYS}-day return window has closed.`;
    else if (openReturn) returnReason = 'A return or replacement request is already open for this order.';

    const allNonReturnable = products.length > 0 && products.every((p) => !p.isReturnable);

    return {
        timeline,
        estimatedDelivery,
        shipments: shipmentViews,
        charges: {
            itemsTotal: Math.round(itemsTotal * 100) / 100,
            mrpTotal: Math.round(mrpTotal * 100) / 100,
            productDiscount: Math.max(0, Math.round((mrpTotal - itemsTotal) * 100) / 100),
            couponCode: order.couponCode ?? null,
            couponDiscount,
            autoDiscount,
            autoDiscountLabel: order.autoDiscountLabel ?? null,
            walletAmount,
            tax: Math.max(0, Math.round((order.totalTaxAmount - Number(order.platformFeeAmount ?? 0)) * 100) / 100),
            platformFee: Number(order.platformFeeAmount ?? 0),
            shipping,
            total: order.totalAmount,
        },
        refunds: refunds.map((r) => ({
            id: r.id,
            // Razorpay refund amounts are stored in paise.
            amount: r.amount / 100,
            status: r.status,
            reference: r.razorpayRefundId,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        })),
        returns: returns.map((r) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            reason: r.reason,
            reasonCode: r.reasonCode,
            images: r.images ?? [],
            refundAmount: r.refundAmount,
            rejectionReason: r.rejectionReason,
            pickupStatus: r.pickupStatus,
            pickupDate: iso(r.pickupDate),
            pickupCarrier: r.pickupCarrier,
            pickupTracking: r.pickupTracking,
            replacementTracking: r.replacementTracking,
            appealNote: r.appealNote,
            appealedAt: iso(r.appealedAt),
            createdAt: r.createdAt.toISOString(),
            items: r.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })),
        })),
        cancellation: cancellation
            ? {
                status: cancellation.status,
                reason: cancellation.reason,
                rejectionReason: cancellation.rejectionReason,
                createdAt: cancellation.createdAt.toISOString(),
            }
            : null,
        eligibility: {
            cancel: { allowed: cancelReason === null, reason: cancelReason },
            return: {
                allowed: returnReason === null,
                reason: returnReason ?? (allNonReturnable ? 'Items in this order are non-returnable; they can come back only if wrong, damaged, defective or incomplete.' : null),
                windowEndsAt: iso(windowEndsAt),
            },
        },
    };
}
