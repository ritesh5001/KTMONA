/**
 * Shipment Types
 * Definitions for shipping and fulfillment
 */
import { ShipmentStatus } from '@prisma/client';
/**
 * Basic Shipment DTO
 */
export interface ShipmentDTO {
    id: string;
    orderId: string;
    sellerId: string;
    carrier: string;
    trackingNumber: string;
    status: ShipmentStatus;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    events?: ShipmentEventDTO[];
}
/**
 * Basic Shipment Event DTO
 */
export interface ShipmentEventDTO {
    id: string;
    shipmentId: string;
    status: ShipmentStatus;
    note: string | null;
    createdAt: Date;
}
/**
 * Input for creating a shipment
 */
export interface CreateShipmentInput {
    carrier: string;
    trackingNumber: string;
}
/**
 * Input for updating shipment status
 */
export interface UpdateShipmentStatusInput {
    status: ShipmentStatus;
    note?: string;
}
/**
 * Tracking info for buyer
 */
export interface TrackingResponse {
    orderId: string;
    status: string;
    shipments: TrackingShipmentInfo[];
}
/**
 * Shipment info for tracking view
 */
export interface TrackingShipmentInfo {
    id: string;
    carrier: string;
    trackingNumber: string;
    status: ShipmentStatus;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    events: ShipmentEventDTO[];
}
/**
 * Seller View of Shipments
 */
export interface SellerShipmentListResponse {
    shipments: (ShipmentDTO & {
        order: {
            id: string;
            createdAt: Date;
            totalAmount: number;
        };
    })[];
}
//# sourceMappingURL=shipment.types.d.ts.map