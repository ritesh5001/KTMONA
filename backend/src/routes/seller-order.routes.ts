import { Router } from 'express';
import { orderController } from '../controllers/order.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

/**
 * Seller Order Routes
 * All routes require SELLER role
 */
export const sellerOrderRouter = Router();

// All seller order routes require authentication and SELLER role
sellerOrderRouter.use(authenticate);
sellerOrderRouter.use(authorize('SELLER'));

// GET /v1/seller/orders - List seller's order items
sellerOrderRouter.get('/', (req, res, next) => orderController.listSellerOrders(req, res, next));

// GET /v1/seller/orders/:id - Get seller's view of an order
sellerOrderRouter.get('/:id', (req, res, next) => orderController.getSellerOrder(req, res, next));
