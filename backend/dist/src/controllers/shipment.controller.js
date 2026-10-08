/**
 * Shipment Controller
 * HTTP request handlers for shipping operations
 */
import { shipmentService } from '../services/shipment.service.js';
import { createShipmentSchema, adminOverrideSchema } from '../validators/shipment.validation.js';
export class ShipmentController {
    /**
     * POST /v1/seller/shipments/:orderId/create
     * Create a shipment for an order
     */
    createShipment = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const orderId = req.params['orderId'];
            // Validate input
            const data = createShipmentSchema.parse(req.body);
            const result = await shipmentService.createShipment(orderId, userId, data);
            res.status(201).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PUT /v1/seller/shipments/:id/ship
     * Mark shipment as SHIPPED
     */
    shipShipment = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params['id'];
            const { note } = req.body;
            const result = await shipmentService.updateStatus(id, userId, 'SHIPPED', note);
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PUT /v1/seller/shipments/:id/deliver
     * Mark shipment as DELIVERED
     */
    deliverShipment = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params['id'];
            const { note } = req.body;
            const result = await shipmentService.updateStatus(id, userId, 'DELIVERED', note);
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /v1/seller/shipments
     * List all shipments for logged-in seller
     */
    listSellerShipments = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const result = await shipmentService.getSellerShipments(userId);
            res.set('Cache-Control', 'no-store');
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /v1/orders/:orderId/tracking
     * Get tracking info for an order (Buyer)
     */
    getTracking = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const orderId = req.params['orderId'];
            const result = await shipmentService.getTracking(orderId, userId);
            res.set('Cache-Control', 'no-store');
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PUT /v1/admin/shipments/:id/override-status
     * Admin Force Update Status
     */
    adminOverride = async (req, res, next) => {
        try {
            const adminId = req.user.userId;
            const id = req.params['id'];
            const { status, note } = adminOverrideSchema.parse(req.body);
            const result = await shipmentService.adminOverrideStatus(id, adminId, status, note);
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    };
}
export const shipmentController = new ShipmentController();
//# sourceMappingURL=shipment.controller.js.map