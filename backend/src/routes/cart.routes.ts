import { Router } from 'express';
import { cartController } from '../controllers/cart.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

/**
 * Cart Routes
 * All routes require USER role (buyer only)
 */
export const cartRouter = Router();

// All cart routes require authentication and USER role
cartRouter.use(authenticate);
cartRouter.use(authorize('USER'));

// GET /v1/cart - Get user's cart
cartRouter.get('/', (req, res, next) => cartController.getCart(req, res, next));

// POST /v1/cart/items - Add item to cart
cartRouter.post('/items', (req, res, next) => cartController.addItem(req, res, next));

// PUT /v1/cart/items/:id - Update cart item quantity
cartRouter.put('/items/:id', (req, res, next) => cartController.updateItem(req, res, next));

// DELETE /v1/cart/items/:id - Remove item from cart
cartRouter.delete('/items/:id', (req, res, next) => cartController.removeItem(req, res, next));
