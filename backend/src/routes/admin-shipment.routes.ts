/**
 * Admin Shipment Routes
 * Base path: /v1/admin/shipments
 */

import { Router } from 'express';
import { shipmentController } from '../controllers/shipment.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// ===================================
// PROTECTED ROUTES (Admin Only)
// ===================================
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

/**
 * PUT /v1/admin/shipments/:id/override-status
 * Force update shipment status
 */
router.put('/:id/override-status', shipmentController.adminOverride);

export const adminShipmentRouter = router;
