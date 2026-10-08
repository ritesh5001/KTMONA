/**
 * Shipment Service
 * Business logic for shipping operations
 */
import { CreateShipmentInput, TrackingResponse, SellerShipmentListResponse, ShipmentDTO } from '../types/shipment.types.js';
import { ShipmentStatus } from '@prisma/client';
export declare class ShipmentService {
    /**
     * Create a shipment for an order (Seller)
     */
    createShipment(orderId: string, sellerId: string, data: CreateShipmentInput): Promise<ShipmentDTO>;
    /**
     * Update Shipment Status (Ship/Deliver)
     */
    updateStatus(shipmentId: string, sellerId: string, status: ShipmentStatus, note?: string): Promise<ShipmentDTO>;
    /**
     * Admin Override Status
     */
    adminOverrideStatus(shipmentId: string, adminId: string, status: ShipmentStatus, note: string): Promise<ShipmentDTO>;
    /**
     * Get Tracking Info (Buyer)
     */
    getTracking(orderId: string, userId: string): Promise<TrackingResponse>;
    /**
     * Get Seller Shipments
     */
    getSellerShipments(sellerId: string): Promise<SellerShipmentListResponse>;
    /**
     * Sync Order status based on all shipments
     */
    private checkAndSyncOrderStatus;
    private mapToDTO;
    private mapToTrackingDTO;
    private mapEventToDTO;
    private invalidateTrackingCache;
}
export declare const shipmentService: ShipmentService;
//# sourceMappingURL=shipment.service.d.ts.map