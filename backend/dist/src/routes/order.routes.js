import { Router } from 'express';
import { orderController } from '../controllers/order.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
/**
 * Buyer Order Routes
 * All routes require USER role (buyer only)
 */
export const orderRouter = Router();
// All order routes require authentication and USER role
orderRouter.use(authenticate);
orderRouter.use(authorize('USER'));
// GET /v1/orders - List buyer's orders
orderRouter.get('/', (req, res, next) => orderController.listBuyerOrders(req, res, next));
// GET /v1/orders/:id - Get buyer's order detail
orderRouter.get('/:id', (req, res, next) => orderController.getBuyerOrder(req, res, next));
// GET /v1/orders/:id/invoice - Download GST invoice PDF
orderRouter.get('/:id/invoice', (req, res, next) => orderController.downloadInvoice(req, res, next));
//# sourceMappingURL=order.routes.js.map