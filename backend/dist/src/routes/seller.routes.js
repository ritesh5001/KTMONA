import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { appointmentController } from '../controllers/appointment.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
/**
 * Seller Routes
 * Base path: /v1/seller
 */
const sellerRouter = Router();
/**
 * POST /v1/seller/register
 * Register a new SELLER (status = PENDING)
 */
sellerRouter.post('/register', authController.registerSeller);
// Seller availability management for appointment booking
sellerRouter.get('/availability', authenticate, authorize('SELLER'), (req, res, next) => appointmentController.listSellerAvailability(req, res, next));
sellerRouter.post('/availability', authenticate, authorize('SELLER'), (req, res, next) => appointmentController.upsertSellerAvailability(req, res, next));
export { sellerRouter };
//# sourceMappingURL=seller.routes.js.map