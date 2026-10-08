/**
 * Seller Shipment Routes
 * Base path: /v1/seller/shipments
 */

import { Router } from 'express';
import { shipmentController } from '../controllers/shipment.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// ===================================
// PROTECTED ROUTES (Seller Only)
// ===================================
router.use(authenticate);
router.use(authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'));

/**
 * GET /v1/seller/shipments
 * List all shipments
 */
router.get('/', shipmentController.listSellerShipments);

/**
 * POST /v1/seller/shipments/:orderId/create
 * Create a new shipment
 */
router.post('/:orderId/create', shipmentController.createShipment);

/**
 * PUT /v1/seller/shipments/:id/ship
 * Mark shipment as SHIPPED
 */
router.put('/:id/ship', shipmentController.shipShipment);

/**
 * PUT /v1/seller/shipments/:id/deliver
 * Mark shipment as DELIVERED
 */
router.put('/:id/deliver', shipmentController.deliverShipment);

export const sellerShipmentRouter = router;
