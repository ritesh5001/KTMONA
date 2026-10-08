/**
 * Shipment Repository
 * Database operations for shipping and fulfillment
 */
import { ShipmentStatus, shipments } from '@prisma/client';
import { CreateShipmentInput } from '../types/shipment.types.js';
export declare class ShipmentRepository {
    /**
     * Create a new shipment and initial event
     */
    create(data: CreateShipmentInput, orderId: string, sellerId: string): Promise<shipments>;
    /**
     * Update shipment status and add event
     */
    updateStatus(shipmentId: string, status: ShipmentStatus, note?: string): Promise<shipments>;
    /**
     * Find shipment by ID
     */
    findById(id: string): Promise<shipments | null>;
    /**
     * Find shipments for an order (for tracking)
     */
    findByOrderId(orderId: string): Promise<shipments[]>;
    /**
     * Find shipments for a seller
     */
    findBySellerId(sellerId: string): Promise<any[]>;
    /**
     * Check if seller already has shipment for order
     */
    existsForSellerAndOrder(sellerId: string, orderId: string): Promise<boolean>;
    /**
     * Count shipments for an order
     */
    countByOrder(orderId: string): Promise<number>;
    /**
     * Count distinct sellers in an order (to compare with shipments count)
     * Using OrderItem to get distinct sellerIds
     */
    countDistinctSellersInOrder(orderId: string): Promise<number>;
    /**
     * Check if all shipments for an order are in specific status (or beyond)
     * e.g. for SHIPPED: check if all have SHIPPED or DELIVERED status
     */
    areAllShipmentsAtLeast(orderId: string, status: ShipmentStatus): Promise<boolean>;
}
export declare const shipmentRepository: ShipmentRepository;
//# sourceMappingURL=shipment.repository.d.ts.map