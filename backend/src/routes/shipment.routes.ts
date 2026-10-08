/**
 * Buyer Shipment Routes
 * Base path: /v1/orders
 */

import { Router } from 'express';
import { shipmentController } from '../controllers/shipment.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// ===================================
// PROTECTED ROUTES (Authenticated User)
// ===================================
router.use(authenticate);

/**
 * GET /v1/orders/:orderId/tracking
 * Get tracking info for an order
 */
router.get(
    '/:orderId/tracking',
    authorize('USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'), // Anyone can try, service checks ownership
    shipmentController.getTracking
);

export const shipmentRoutes = router;
