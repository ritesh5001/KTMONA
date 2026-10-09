/**
 * Seller orders, Meesho-style: Pending → Ready to Ship → Shipped → Delivered,
 * plus Cancelled and RTO. A seller's "sub-order" is their items in an order
 * and their shipment for it.
 */

import { Prisma, ShipmentStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../errors/ApiError.js';
import { shipmentService } from '../shipment.service.js';
import { cancellationService } from '../cancellation.service.js';
import { invalidateSellerPrivateCaches } from '../../utils/cache.util.js';
import { chargePenalty, getPenaltyRules } from '../admin-center/penalties.service.js';
import {
    DISPATCH_SLA_HOURS,
    addDays,
    dispatchBy,
    parseLimit,
    parsePage,
    round2,
    sellerCode,
    toCsv,
} from './common.js';
import { renderLabels, renderManifest, type LabelData } from './labels.js';
import {
    bookShipment,
    generateManifest,
    isShiprocketShippingEnabled,
    requestPickup,
} from './shiprocket-shipping.client.js';

const log = logger.child({ module: 'seller-orders' });

export const ORDER_TABS = ['on_hold', 'pending', 'ready_to_ship', 'shipped', 'delivered', 'cancelled', 'rto', 'all'] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

async function sellerCancelledOrderIds(sellerId: string): Promise<string[]> {
    const rows = await prisma.sellerOrderCancellation.findMany({ where: { sellerId }, select: { orderId: true } });
    return rows.map((r) => r.orderId);
}

function tabWhere(sellerId: string, tab: OrderTab, cancelledIds: string[]): Prisma.OrderWhereInput {
    const mine: Prisma.OrderWhereInput = { items: { some: { sellerId } } };
    const shipmentIn = (statuses: ShipmentStatus[]): Prisma.OrderWhereInput => ({
        ...mine,
        status: { not: 'CANCELLED' },
        id: { notIn: cancelledIds },
        shipments: { some: { seller_id: sellerId, status: { in: statuses } } },
    });
    switch (tab) {
        case 'on_hold':
            // Customer asked to cancel: hold dispatch until the seller decides.
            return {
                ...mine,
                status: 'CONFIRMED',
                id: { notIn: cancelledIds },
                shipments: { none: { seller_id: sellerId } },
                cancellationRequest: { is: { status: 'REQUESTED' } },
            };
        case 'pending':
            return {
                ...mine,
                status: 'CONFIRMED',
                id: { notIn: cancelledIds },
                shipments: { none: { seller_id: sellerId } },
                NOT: { cancellationRequest: { is: { status: 'REQUESTED' } } },
            };
        case 'ready_to_ship':
            return shipmentIn(['CREATED']);
        case 'shipped':
            return shipmentIn(['SHIPPED']);
        case 'delivered':
            return shipmentIn(['DELIVERED']);
        case 'rto':
            return shipmentIn(['RTO_INITIATED', 'RTO_DELIVERED']);
        case 'cancelled':
            return { OR: [{ ...mine, status: 'CANCELLED' }, { id: { in: cancelledIds } }] };
        case 'all':
        default:
            return { ...mine, status: { not: 'PLACED' } };
    }
}

/** Meesho filters: SLA status, order date range and SKU. */
async function filterWhere(sellerId: string, query: Record<string, unknown>): Promise<Prisma.OrderWhereInput[]> {
    const out: Prisma.OrderWhereInput[] = [];
    const now = new Date();
    const slaCutoff = (hoursFromNow: number) => new Date(now.getTime() - (DISPATCH_SLA_HOURS - hoursFromNow) * 3_600_000);
    // dispatchBy = createdAt + SLA, so "breached" means createdAt < now - SLA.
    if (query.sla === 'breached') out.push({ createdAt: { lt: slaCutoff(0) } });
    if (query.sla === 'due_today') {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        const hoursLeft = (endOfDay.getTime() - now.getTime()) / 3_600_000;
        out.push({ createdAt: { gte: slaCutoff(0), lte: slaCutoff(hoursLeft) } });
    }
    if (query.sla === 'due_later') {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        out.push({ createdAt: { gt: slaCutoff((endOfDay.getTime() - now.getTime()) / 3_600_000) } });
    }
    const from = typeof query.from === 'string' && query.from ? new Date(query.from) : null;
    const to = typeof query.to === 'string' && query.to ? new Date(`${query.to}T23:59:59.999`) : null;
    if (from && !Number.isNaN(from.getTime())) out.push({ createdAt: { gte: from } });
    if (to && !Number.isNaN(to.getTime())) out.push({ createdAt: { lte: to } });
    const sku = typeof query.sku === 'string' ? query.sku.trim() : '';
    if (sku) {
        const variants = await prisma.productVariant.findMany({
            where: { product: { sellerId }, sku: { contains: sku, mode: 'insensitive' } },
            select: { id: true },
            take: 200,
        });
        out.push({ items: { some: { sellerId, variantId: { in: variants.map((v) => v.id) } } } });
    }
    return out;
}

const orderInclude = {
    items: true,
    payment: { select: { provider: true, status: true } },
    shipments: true,
    cancellationRequest: { select: { id: true, status: true, reason: true, createdAt: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

class SellerOrdersService {
    async counts(sellerId: string): Promise<Record<OrderTab, number>> {
        const cancelledIds = await sellerCancelledOrderIds(sellerId);
        const entries = await Promise.all(
            ORDER_TABS.map(async (tab) => [tab, await prisma.order.count({ where: tabWhere(sellerId, tab, cancelledIds) })] as const)
        );
        return Object.fromEntries(entries) as Record<OrderTab, number>;
    }

    async list(sellerId: string, query: Record<string, unknown>) {
        const tab = (ORDER_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as OrderTab) : 'pending';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 20, 100);
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const cancelledIds = await sellerCancelledOrderIds(sellerId);

        const where: Prisma.OrderWhereInput = { AND: [tabWhere(sellerId, tab, cancelledIds)] };
        if (search) {
            (where.AND as Prisma.OrderWhereInput[]).push({
                OR: [
                    { id: { contains: search, mode: 'insensitive' } },
                    { shippingName: { contains: search, mode: 'insensitive' } },
                    { shippingPhone: { contains: search } },
                    { shipments: { some: { seller_id: sellerId, tracking_number: { contains: search, mode: 'insensitive' } } } },
                ],
            });
        }
        for (const extra of await filterWhere(sellerId, query)) (where.AND as Prisma.OrderWhereInput[]).push(extra);

        const [total, orders, counts] = await Promise.all([
            prisma.order.count({ where }),
            prisma.order.findMany({
                where,
                include: orderInclude,
                // Oldest first for work queues (dispatch the most urgent), newest first otherwise.
                orderBy: { createdAt: tab === 'pending' || tab === 'ready_to_ship' ? 'asc' : 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.counts(sellerId),
        ]);

        const rows = await this.toRows(sellerId, orders, cancelledIds);
        return { tab, counts, orders: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    /** "Download Orders Data": every order in the tab + filters, as CSV. */
    async exportCsv(sellerId: string, query: Record<string, unknown>): Promise<string> {
        const rows: unknown[][] = [];
        let page = 1;
        for (;;) {
            const res = await this.list(sellerId, { ...query, page, limit: 100 });
            for (const o of res.orders) {
                for (const i of o.items) {
                    rows.push([
                        o.orderId, o.orderDate, o.status, o.paymentMode, o.dispatchBy, o.slaBreached ? 'Yes' : 'No',
                        i.title, i.sku, i.size, i.color, i.quantity, i.sellerPrice, i.lineTotal,
                        o.customer.name, o.customer.city, o.customer.pincode,
                        o.shipment?.carrier ?? '', o.shipment?.awb ?? '',
                    ]);
                }
            }
            if (page >= res.pagination.totalPages || page >= 50) break;
            page += 1;
        }
        return toCsv(
            ['Order ID', 'Order Date', 'Status', 'Payment', 'Dispatch By', 'SLA Breached', 'Product', 'SKU', 'Size', 'Colour', 'Qty', 'Your Price', 'Line Total', 'Customer', 'City', 'Pincode', 'Courier', 'AWB'],
            rows
        );
    }

    async detail(sellerId: string, orderId: string) {
        const order = await prisma.order.findFirst({ where: { id: orderId, items: { some: { sellerId } } }, include: orderInclude });
        if (!order) throw ApiError.notFound('Order not found');
        const [row] = await this.toRows(sellerId, [order], await sellerCancelledOrderIds(sellerId));
        const shipment = order.shipments.find((s) => s.seller_id === sellerId);
        const events = shipment
            ? await prisma.shipment_events.findMany({ where: { shipment_id: shipment.id }, orderBy: { created_at: 'asc' } })
            : [];
        return { ...row, timeline: events.map((e) => ({ status: e.status, note: e.note, at: e.created_at })) };
    }

    private async toRows(sellerId: string, orders: OrderRow[], cancelledIds: string[]) {
        const myItems = orders.flatMap((o) => o.items.filter((i) => i.sellerId === sellerId));
        const [products, variants] = await Promise.all([
            prisma.product.findMany({
                where: { id: { in: [...new Set(myItems.map((i) => i.productId))] } },
                select: { id: true, title: true, images: true },
            }),
            prisma.productVariant.findMany({
                where: { id: { in: [...new Set(myItems.map((i) => i.variantId))] } },
                select: { id: true, size: true, color: true, sku: true, images: true },
            }),
        ]);
        const productMap = new Map(products.map((p) => [p.id, p]));
        const variantMap = new Map(variants.map((v) => [v.id, v]));
        const now = Date.now();
        const cancelledSet = new Set(cancelledIds);

        return orders.map((order) => {
            const items = order.items.filter((i) => i.sellerId === sellerId);
            const shipment = order.shipments.find((s) => s.seller_id === sellerId) ?? null;
            const due = dispatchBy(order.createdAt);
            const isPrepaid = order.payment?.provider !== 'COD';
            const sellerCancelled = cancelledSet.has(order.id);
            const status = sellerCancelled || order.status === 'CANCELLED'
                ? 'CANCELLED'
                : !shipment
                    ? 'PENDING'
                    : shipment.status === 'CREATED'
                        ? 'READY_TO_SHIP'
                        : shipment.status;
            const awaitingDispatch = status === 'PENDING' || status === 'READY_TO_SHIP';
            return {
                orderId: order.id,
                orderDate: order.createdAt,
                status,
                dispatchBy: due,
                slaBreached: awaitingDispatch && due.getTime() < now,
                lateDispatch: Boolean(shipment?.shipped_at && shipment.shipped_at > due),
                paymentMode: isPrepaid ? 'PREPAID' : 'COD',
                customer: {
                    name: order.shippingName,
                    city: order.shippingCity,
                    pincode: order.shippingPincode,
                },
                items: items.map((i) => {
                    const p = productMap.get(i.productId);
                    const v = variantMap.get(i.variantId);
                    return {
                        id: i.id,
                        productId: i.productId,
                        title: p?.title ?? 'Product',
                        image: v?.images?.[0] ?? p?.images?.[0] ?? null,
                        size: v?.size ?? null,
                        color: v?.color ?? null,
                        sku: v?.sku ?? null,
                        quantity: i.quantity,
                        sellerPrice: i.sellerPriceSnapshot,
                        lineTotal: round2(i.sellerPriceSnapshot * i.quantity),
                    };
                }),
                sellerAmount: round2(items.reduce((sum, i) => sum + i.sellerPriceSnapshot * i.quantity, 0)),
                units: items.reduce((sum, i) => sum + i.quantity, 0),
                shipment: shipment && {
                    id: shipment.id,
                    status: shipment.status,
                    mode: shipment.fulfillment_mode,
                    carrier: shipment.carrier,
                    awb: shipment.tracking_number || null,
                    labelUrl: shipment.label_url,
                    manifestId: shipment.manifest_id,
                    shippedAt: shipment.shipped_at,
                    deliveredAt: shipment.delivered_at,
                    rtoInitiatedAt: shipment.rto_initiated_at,
                    rtoDeliveredAt: shipment.rto_delivered_at,
                    rtoReason: shipment.rto_reason,
                },
                customerCancellation:
                    order.cancellationRequest && order.cancellationRequest.status === 'REQUESTED'
                        ? order.cancellationRequest
                        : null,
                expectedPayoutDate: shipment?.delivered_at ? addDays(shipment.delivered_at, 7) : null,
            };
        });
    }

    /** Accept pending orders: create the shipment and generate the label. */
    async accept(sellerId: string, orderIds: string[]) {
        const profile = await prisma.seller_profiles.findUnique({ where: { user_id: sellerId } });
        const useShiprocket = isShiprocketShippingEnabled() && Boolean(profile?.pickup_pincode);
        const results: { orderId: string; ok: boolean; error?: string }[] = [];
        const bookedShipmentIds: string[] = [];

        for (const orderId of orderIds) {
            try {
                let carrier = 'Self Ship';
                let awb = '';
                let booking: Awaited<ReturnType<typeof bookShipment>> | null = null;

                if (useShiprocket) {
                    booking = await this.book(sellerId, orderId);
                    carrier = booking.courier;
                    awb = booking.awb;
                }

                const created = await shipmentService.createShipment(orderId, sellerId, { carrier, trackingNumber: awb });
                await prisma.shipments.update({
                    where: { id: created.id },
                    data: {
                        fulfillment_mode: booking ? 'SHIPROCKET' : 'SELF_SHIP',
                        shiprocket_order_id: booking?.shiprocketOrderId ?? null,
                        shiprocket_shipment_id: booking?.shipmentId ?? null,
                        label_url: booking?.labelUrl ?? null,
                        label_generated_at: new Date(),
                        updated_at: new Date(),
                    },
                });
                if (booking) bookedShipmentIds.push(booking.shipmentId);
                results.push({ orderId, ok: true });
            } catch (err) {
                results.push({ orderId, ok: false, error: err instanceof Error ? err.message : 'Failed' });
            }
        }

        if (bookedShipmentIds.length > 0) {
            try {
                await requestPickup(bookedShipmentIds);
                await prisma.shipments.updateMany({
                    where: { shiprocket_shipment_id: { in: bookedShipmentIds } },
                    data: { pickup_requested_at: new Date() },
                });
            } catch (err) {
                log.warn({ err }, 'Shiprocket pickup request failed; seller can retry from manifest');
            }
        }

        await invalidateSellerPrivateCaches(sellerId);
        return { results, mode: useShiprocket ? 'SHIPROCKET' : 'SELF_SHIP' };
    }

    private async book(sellerId: string, orderId: string) {
        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, payment: true } });
        if (!order) throw ApiError.notFound('Order not found');
        const items = order.items.filter((i) => i.sellerId === sellerId);
        const variants = await prisma.productVariant.findMany({
            where: { id: { in: items.map((i) => i.variantId) } },
            select: { id: true, sku: true, weightGrams: true, product: { select: { title: true, hsnCode: true } } },
        });
        const vMap = new Map(variants.map((v) => [v.id, v]));
        const weightGrams = items.reduce((sum, i) => sum + (vMap.get(i.variantId)?.weightGrams ?? 500) * i.quantity, 0);
        return bookShipment({
            orderId: `${order.id}-${sellerCode(sellerId)}`,
            orderDate: order.createdAt,
            pickupLocation: sellerCode(sellerId),
            customer: {
                name: order.shippingName ?? 'Customer',
                phone: order.shippingPhone ?? '',
                email: order.shippingEmail,
                address: order.shippingAddressLine1 ?? '',
                address2: order.shippingAddressLine2,
                city: order.shippingCity ?? '',
                pincode: order.shippingPincode ?? '',
            },
            items: items.map((i) => ({
                name: vMap.get(i.variantId)?.product.title ?? 'Item',
                sku: vMap.get(i.variantId)?.sku ?? i.variantId,
                units: i.quantity,
                sellingPrice: i.priceSnapshot,
                hsn: vMap.get(i.variantId)?.product.hsnCode ?? null,
            })),
            paymentMethod: order.payment?.provider === 'COD' ? 'COD' : 'Prepaid',
            subTotal: round2(items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0)),
            weightKg: Math.max(0.1, weightGrams / 1000),
            dimensionsCm: { length: 30, breadth: 25, height: 5 },
        });
    }

    /** Self-ship: record the courier and AWB before handing over. */
    async updateTracking(sellerId: string, orderId: string, carrier: string, awb: string) {
        const shipment = await prisma.shipments.findFirst({ where: { order_id: orderId, seller_id: sellerId } });
        if (!shipment) throw ApiError.notFound('Accept the order first');
        if (shipment.fulfillment_mode === 'SHIPROCKET') throw ApiError.badRequest('AWB is assigned by Shiprocket for this order');
        if (shipment.status !== 'CREATED') throw ApiError.badRequest('Tracking can only be edited before the parcel is shipped');
        await prisma.shipments.update({
            where: { id: shipment.id },
            data: { carrier: carrier.trim(), tracking_number: awb.trim(), updated_at: new Date() },
        });
        await invalidateSellerPrivateCaches(sellerId);
        return { ok: true };
    }

    /** Parcel handed to the courier. */
    async markShipped(sellerId: string, orderIds: string[]) {
        const results: { orderId: string; ok: boolean; error?: string }[] = [];
        for (const orderId of orderIds) {
            try {
                const shipment = await prisma.shipments.findFirst({ where: { order_id: orderId, seller_id: sellerId } });
                if (!shipment) throw ApiError.badRequest('Order has not been accepted yet');
                if (!shipment.tracking_number) throw ApiError.badRequest('Add the courier and AWB number first');
                await shipmentService.updateStatus(shipment.id, sellerId, 'SHIPPED', 'Handed over to courier');
                results.push({ orderId, ok: true });
            } catch (err) {
                results.push({ orderId, ok: false, error: err instanceof Error ? err.message : 'Failed' });
            }
        }
        await invalidateSellerPrivateCaches(sellerId);
        return { results };
    }

    /** Seller marks the parcel delivered (self-ship only; Shiprocket reports it). */
    async markDelivered(sellerId: string, orderId: string) {
        const shipment = await prisma.shipments.findFirst({ where: { order_id: orderId, seller_id: sellerId } });
        if (!shipment) throw ApiError.notFound('Shipment not found');
        await shipmentService.updateStatus(shipment.id, sellerId, 'DELIVERED', 'Marked delivered by seller');
        await invalidateSellerPrivateCaches(sellerId);
        return { ok: true };
    }

    async cancel(sellerId: string, orderId: string, reason: string) {
        const order = await prisma.order.findFirst({
            where: { id: orderId, items: { some: { sellerId } } },
            include: { items: { select: { sellerId: true } }, shipments: true, cancellationRequest: true },
        });
        if (!order) throw ApiError.notFound('Order not found');
        if (order.status === 'CANCELLED') throw ApiError.badRequest('Order is already cancelled');
        const shipment = order.shipments.find((s) => s.seller_id === sellerId);
        if (shipment && shipment.status !== 'CREATED') throw ApiError.badRequest('Shipped orders cannot be cancelled');

        await prisma.sellerOrderCancellation.upsert({
            where: { orderId_sellerId: { orderId, sellerId } },
            create: { orderId, sellerId, reason },
            update: { reason },
        });

        const cancellation =
            order.cancellationRequest ??
            (await prisma.cancellationRequest.create({
                data: { orderId, userId: order.userId, reason: `Cancelled by seller: ${reason}` },
            }));

        const sellers = new Set(order.items.map((i) => i.sellerId));
        if (sellers.size === 1) {
            // Full cancel: restocks and refunds via the normal cancellation flow.
            await cancellationService.approveCancellationBySeller(sellerId, cancellation.id);
        }
        // Multi-seller orders wait in the admin cancellation queue.

        const rules = await getPenaltyRules();
        await chargePenalty(sellerId, orderId, rules.sellerCancelPenalty, 'Seller cancellation charge');

        await invalidateSellerPrivateCaches(sellerId);
        return { ok: true, needsAdminApproval: sellers.size > 1 };
    }

    async approveCustomerCancellation(sellerId: string, orderId: string) {
        const request = await prisma.cancellationRequest.findUnique({ where: { orderId } });
        if (!request) throw ApiError.notFound('No cancellation request for this order');
        const result = await cancellationService.approveCancellationBySeller(sellerId, request.id);
        await invalidateSellerPrivateCaches(sellerId);
        return result;
    }

    /** RTO: courier is returning the parcel (initiated) / seller got it back (received). */
    async rto(sellerId: string, orderId: string, action: 'initiated' | 'received', reason?: string) {
        const shipment = await prisma.shipments.findFirst({ where: { order_id: orderId, seller_id: sellerId } });
        if (!shipment) throw ApiError.notFound('Shipment not found');
        if (action === 'initiated') {
            if (shipment.status !== 'SHIPPED') throw ApiError.badRequest('Only in-transit parcels can be marked RTO');
            await prisma.shipments.update({
                where: { id: shipment.id },
                data: {
                    status: 'RTO_INITIATED',
                    rto_initiated_at: new Date(),
                    rto_reason: reason ?? 'Returned by courier',
                    updated_at: new Date(),
                    shipment_events: { create: { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, status: 'RTO_INITIATED', note: reason ?? 'RTO initiated' } },
                },
            });
        } else {
            if (shipment.status !== 'RTO_INITIATED') throw ApiError.badRequest('RTO has not been initiated for this order');
            await prisma.shipments.update({
                where: { id: shipment.id },
                data: {
                    status: 'RTO_DELIVERED',
                    rto_delivered_at: new Date(),
                    updated_at: new Date(),
                    shipment_events: { create: { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, status: 'RTO_DELIVERED', note: 'RTO parcel received by seller' } },
                },
            });
        }
        await invalidateSellerPrivateCaches(sellerId);
        return { ok: true };
    }

    // ── Documents ───────────────────────────────────────────────────────────

    async labelsPdf(sellerId: string, orderIds: string[]): Promise<Buffer> {
        const [orders, profile] = await Promise.all([
            prisma.order.findMany({
                where: { id: { in: orderIds }, items: { some: { sellerId } } },
                include: orderInclude,
            }),
            prisma.seller_profiles.findUnique({ where: { user_id: sellerId } }),
        ]);
        if (orders.length === 0) throw ApiError.notFound('No orders found');
        const rows = await this.toRows(sellerId, orders, []);
        const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { phone: true } });

        const labels: LabelData[] = rows.map((row) => {
            const order = orders.find((o) => o.id === row.orderId)!;
            return {
                orderId: row.orderId,
                orderDate: row.orderDate,
                awb: row.shipment?.awb ?? null,
                courier: row.shipment?.carrier ?? 'Courier',
                paymentMode: row.paymentMode as 'PREPAID' | 'COD',
                codAmount: row.paymentMode === 'COD' ? round2(order.items.filter((i) => i.sellerId === sellerId).reduce((s, i) => s + i.priceSnapshot * i.quantity, 0)) : 0,
                shipTo: {
                    name: order.shippingName ?? 'Customer',
                    phone: order.shippingPhone ?? '',
                    line1: order.shippingAddressLine1 ?? '',
                    line2: order.shippingAddressLine2,
                    city: order.shippingCity ?? '',
                    pincode: order.shippingPincode ?? '',
                },
                returnTo: {
                    name: profile?.store_name ?? 'KTMONA Seller',
                    phone: profile?.pickup_phone ?? seller?.phone ?? '',
                    line1: profile?.pickup_address_line1 ?? 'Pickup address not set',
                    line2: profile?.pickup_address_line2 ?? null,
                    city: profile?.pickup_city ?? '',
                    state: profile?.pickup_state ?? null,
                    pincode: profile?.pickup_pincode ?? '',
                },
                items: row.items.map((i) => ({ title: i.title, sku: i.sku ?? '', size: i.size ?? 'Default', color: i.color, quantity: i.quantity })),
                gstin: profile?.gstin ?? profile?.gst_number ?? null,
            };
        });
        return renderLabels(labels);
    }

    /** Group ready-to-ship parcels into a pickup manifest. */
    async manifestPdf(sellerId: string, orderIds: string[]): Promise<{ pdf: Buffer; manifestId: string }> {
        const shipments = await prisma.shipments.findMany({
            where: { seller_id: sellerId, order_id: { in: orderIds }, status: { in: ['CREATED', 'SHIPPED'] } },
            include: { orders: { include: { items: true, payment: { select: { provider: true } } } } },
        });
        if (shipments.length === 0) throw ApiError.badRequest('Select accepted orders to add to the manifest');

        const manifestId = `MNF-${sellerCode(sellerId)}-${Date.now().toString(36).toUpperCase()}`;
        await prisma.shipments.updateMany({
            where: { id: { in: shipments.map((s) => s.id) } },
            data: { manifest_id: manifestId, manifested_at: new Date() },
        });

        const shiprocketIds = shipments.map((s) => s.shiprocket_shipment_id).filter((v): v is string => Boolean(v));
        if (shiprocketIds.length > 0) {
            try {
                await generateManifest(shiprocketIds);
            } catch (err) {
                log.warn({ err }, 'Shiprocket manifest failed; KTMONA manifest still issued');
            }
        }

        const profile = await prisma.seller_profiles.findUnique({ where: { user_id: sellerId } });
        const pdf = await renderManifest({
            manifestId,
            createdAt: new Date(),
            seller: {
                storeName: profile?.store_name ?? 'Seller',
                sellerCode: sellerCode(sellerId),
                address: [profile?.pickup_address_line1, profile?.pickup_address_line2, profile?.pickup_city, profile?.pickup_state, profile?.pickup_pincode]
                    .filter(Boolean)
                    .join(', ') || 'Not set',
            },
            rows: shipments.map((s) => ({
                orderId: s.order_id,
                awb: s.tracking_number || null,
                courier: s.carrier,
                items: s.orders.items.filter((i) => i.sellerId === sellerId).reduce((n, i) => n + i.quantity, 0),
                paymentMode: s.orders.payment?.provider === 'COD' ? 'COD' : 'Prepaid',
            })),
        });
        await invalidateSellerPrivateCaches(sellerId);
        return { pdf, manifestId };
    }
}

export const sellerOrdersService = new SellerOrdersService();
