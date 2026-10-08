/**
 * Shipment Controller
 * HTTP request handlers for shipping operations
 */
import { Request, Response, NextFunction } from 'express';
export declare class ShipmentController {
    /**
     * POST /v1/seller/shipments/:orderId/create
     * Create a shipment for an order
     */
    createShipment: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/seller/shipments/:id/ship
     * Mark shipment as SHIPPED
     */
    shipShipment: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/seller/shipments/:id/deliver
     * Mark shipment as DELIVERED
     */
    deliverShipment: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/seller/shipments
     * List all shipments for logged-in seller
     */
    listSellerShipments: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/orders/:orderId/tracking
     * Get tracking info for an order (Buyer)
     */
    getTracking: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/admin/shipments/:id/override-status
     * Admin Force Update Status
     */
    adminOverride: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const shipmentController: ShipmentController;
//# sourceMappingURL=shipment.controller.d.ts.map