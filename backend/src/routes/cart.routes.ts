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

// PATCH /v1/cart/items/:id/save-for-later - Save for later / move back to cart
cartRouter.patch('/items/:id/save-for-later', (req, res, next) => cartController.setSavedForLater(req, res, next));

// PATCH /v1/cart/items/:id/variant - Change size/colour
cartRouter.patch('/items/:id/variant', (req, res, next) => cartController.changeVariant(req, res, next));

// POST /v1/cart/merge - Add a guest's on-device cart after sign-in
cartRouter.post('/merge', (req, res, next) => cartController.merge(req, res, next));

// DELETE /v1/cart/items/:id - Remove item from cart
cartRouter.delete('/items/:id', (req, res, next) => cartController.removeItem(req, res, next));
