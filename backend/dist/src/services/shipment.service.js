/**
 * Shipment Service
 * Business logic for shipping operations
 */
import { shipmentRepository } from '../repositories/shipment.repository.js';
import { prisma } from '../config/db.js';
import { emitShipmentCreated, emitShipmentShipped, emitShipmentDelivered } from '../events/order.events.js';
import { ApiError } from '../errors/ApiError.js';
import { invalidateCache, CACHE_KEYS } from '../utils/cache.util.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, orderTag } from '../live/cache-tags.js';
export class ShipmentService {
    /**
     * Create a shipment for an order (Seller)
     */
    async createShipment(orderId, sellerId, data) {
        // 1. Verify Order exists and is CONFIRMED
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });
        if (!order) {
            throw new ApiError(404, 'Order not found');
        }
        if (order.status !== 'CONFIRMED') {
            throw new ApiError(400, `Cannot ship order with status ${order.status}. Order must be CONFIRMED.`);
        }
        // 2. Verify Seller owns items in this order
        const sellerItems = await prisma.orderItem.count({
            where: {
                orderId,
                sellerId
            }
        });
        if (sellerItems === 0) {
            throw new ApiError(403, 'You do not have any items in this order to ship');
        }
        // 3. Verify Seller hasn't already shipped
        const existing = await shipmentRepository.existsForSellerAndOrder(sellerId, orderId);
        if (existing) {
            throw new ApiError(400, 'Shipment already exists for this order');
        }
        // 4. Create Shipment
        const shipment = await shipmentRepository.create(data, orderId, sellerId);
        // 5. Invalidate tracking cache
        // Now using actual cache key
        await this.invalidateTrackingCache(orderId);
        await emitShipmentCreated(orderId, shipment.carrier, shipment.tracking_number);
        await dispatchFreshness({
            type: 'shipment.updated',
            entityId: orderId,
            tags: [
                CACHE_TAGS.shipments,
                CACHE_TAGS.orders,
                CACHE_TAGS.sellerOrders,
                CACHE_TAGS.userOrders,
                orderTag(orderId),
            ],
            audience: { allAuthenticated: true },
        });
        return this.mapToDTO(shipment);
    }
    /**
     * Update Shipment Status (Ship/Deliver)
     */
    async updateStatus(shipmentId, sellerId, status, note) {
        const shipment = await shipmentRepository.findById(shipmentId);
        if (!shipment) {
            throw new ApiError(404, 'Shipment not found');
        }
        if (shipment.seller_id !== sellerId) {
            throw new ApiError(403, 'Unauthorized to update this shipment');
        }
        // Validate transitions
        if (shipment.status === 'DELIVERED') {
            throw new ApiError(400, 'Cannot update delivered shipment');
        }
        if (status === 'SHIPPED' && shipment.status !== 'CREATED') {
            throw new ApiError(400, 'Shipment can only be marked SHIPPED from CREATED state');
        }
        if (status === 'DELIVERED' && shipment.status !== 'SHIPPED') {
            throw new ApiError(400, 'Shipment can only be marked DELIVERED from SHIPPED state');
        }
        // Update
        const updated = await shipmentRepository.updateStatus(shipmentId, status, note);
        // Invalidate tracking cache
        await this.invalidateTrackingCache(shipment.order_id);
        // Check if Order status needs update
        await this.checkAndSyncOrderStatus(shipment.order_id);
        // Notify Buyer (event-driven, idempotent, best-effort)
        if (status === 'SHIPPED') {
            await emitShipmentShipped(shipment.order_id, shipment.carrier, shipment.tracking_number);
        }
        else if (status === 'DELIVERED') {
            await emitShipmentDelivered(shipment.order_id);
        }
        await dispatchFreshness({
            type: 'shipment.updated',
            entityId: shipment.order_id,
            tags: [
                CACHE_TAGS.shipments,
                CACHE_TAGS.orders,
                CACHE_TAGS.sellerOrders,
                CACHE_TAGS.userOrders,
                orderTag(shipment.order_id),
            ],
            audience: { allAuthenticated: true },
        });
        return this.mapToDTO(updated);
    }
    /**
     * Admin Override Status
     */
    async adminOverrideStatus(shipmentId, adminId, status, note) {
        const shipment = await shipmentRepository.findById(shipmentId);
        if (!shipment)
            throw new ApiError(404, 'Shipment not found');
        const updated = await shipmentRepository.updateStatus(shipmentId, status, `Admin Override: ${note}`);
        // Audit Log
        await prisma.auditLog.create({
            data: {
                actorId: adminId,
                action: 'SHIPMENT_STATUS_OVERRIDE',
                entityType: 'ORDER', // Close enough, or add generic
                entityId: shipment.order_id,
                metadata: {
                    shipmentId,
                    oldStatus: shipment.status,
                    newStatus: status,
                    reason: note
                }
            }
        });
        // Sync order status
        await this.checkAndSyncOrderStatus(shipment.order_id);
        await dispatchFreshness({
            type: 'shipment.updated',
            entityId: shipment.order_id,
            tags: [
                CACHE_TAGS.shipments,
                CACHE_TAGS.orders,
                CACHE_TAGS.sellerOrders,
                CACHE_TAGS.userOrders,
                orderTag(shipment.order_id),
            ],
            audience: { allAuthenticated: true },
        });
        return this.mapToDTO(updated);
    }
    /**
     * Get Tracking Info (Buyer)
     */
    async getTracking(orderId, userId) {
        // Verify ownership
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { userId: true, status: true }
        });
        if (!order)
            throw new ApiError(404, 'Order not found');
        // Allow if user is owner OR admin (but this method is for buyer mainly)
        // If accessed by admin, different flow usually.
        // Basic check:
        if (order.userId !== userId) {
            throw new ApiError(403, 'Unauthorized to view tracking for this order');
        }
        const shipments = await shipmentRepository.findByOrderId(orderId);
        return {
            orderId,
            status: order.status,
            shipments: shipments.map(this.mapToTrackingDTO)
        };
    }
    /**
     * Get Seller Shipments
     */
    async getSellerShipments(sellerId) {
        const raw = await shipmentRepository.findBySellerId(sellerId);
        return {
            shipments: raw.map(s => ({
                id: s.id,
                orderId: s.order_id,
                sellerId: s.seller_id,
                carrier: s.carrier,
                trackingNumber: s.tracking_number,
                status: s.status,
                shippedAt: s.shipped_at,
                deliveredAt: s.delivered_at,
                createdAt: s.created_at,
                order: {
                    id: s.orders.id,
                    createdAt: s.orders.createdAt,
                    totalAmount: s.orders.totalAmount
                }
            }))
        };
    }
    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================
    /**
     * Sync Order status based on all shipments
     */
    async checkAndSyncOrderStatus(orderId) {
        // Check if ALL sellers have shipped
        const allShipped = await shipmentRepository.areAllShipmentsAtLeast(orderId, 'SHIPPED');
        const allDelivered = await shipmentRepository.areAllShipmentsAtLeast(orderId, 'DELIVERED');
        let newStatus = null;
        if (allDelivered) {
            newStatus = 'DELIVERED';
        }
        else if (allShipped) {
            newStatus = 'SHIPPED';
        }
        if (newStatus) {
            // Only update if status implies progress (e.g. don't go back from DELIVERED to SHIPPED unless force)
            // But areAllShipmentsAtLeast handles logic.
            // Just double check current order status
            const currentOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
            if (currentOrder && currentOrder.status !== newStatus) {
                // Prevent regression? E.g. if already DELIVERED, don't set to SHIPPED.
                // But if allDelivered is true, then we set DELIVERED.
                // Logic seems sound.
                if (currentOrder.status === 'DELIVERED' && newStatus === 'SHIPPED')
                    return;
                await prisma.order.update({
                    where: { id: orderId },
                    data: { status: newStatus }
                });
            }
        }
    }
    mapToDTO(shipment) {
        return {
            id: shipment.id,
            orderId: shipment.order_id,
            sellerId: shipment.seller_id,
            carrier: shipment.carrier,
            trackingNumber: shipment.tracking_number,
            status: shipment.status,
            shippedAt: shipment.shipped_at,
            deliveredAt: shipment.delivered_at,
            createdAt: shipment.created_at,
            events: shipment.shipment_events?.map(this.mapEventToDTO)
        };
    }
    mapToTrackingDTO(shipment) {
        return {
            id: shipment.id,
            carrier: shipment.carrier,
            trackingNumber: shipment.tracking_number,
            status: shipment.status,
            shippedAt: shipment.shipped_at,
            deliveredAt: shipment.delivered_at,
            events: shipment.shipment_events?.map((e) => ({
                id: e.id,
                shipmentId: e.shipment_id,
                status: e.status,
                note: e.note,
                createdAt: e.created_at
            }))
        };
    }
    mapEventToDTO(event) {
        return {
            id: event.id,
            shipmentId: event.shipment_id,
            status: event.status,
            note: event.note,
            createdAt: event.created_at
        };
    }
    async invalidateTrackingCache(orderId) {
        await invalidateCache(CACHE_KEYS.TRACKING(orderId));
    }
}
export const shipmentService = new ShipmentService();
//# sourceMappingURL=shipment.service.js.map