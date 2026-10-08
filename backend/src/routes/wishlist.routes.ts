import { Router } from 'express';
import { wishlistController } from '../controllers/wishlist.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

/**
 * Wishlist Routes
 * All routes require USER role (buyer only)
 */
export const wishlistRouter = Router();

// All wishlist routes require authentication and USER role
wishlistRouter.use(authenticate);
wishlistRouter.use(authorize('USER'));

// GET /v1/wishlist - List all wishlist items
wishlistRouter.get('/', (req, res, next) => wishlistController.getWishlist(req, res, next));

// GET /v1/wishlist/count - Get wishlist item count
wishlistRouter.get('/count', (req, res, next) => wishlistController.getCount(req, res, next));

// POST /v1/wishlist/toggle - Toggle product in/out of wishlist
wishlistRouter.post('/toggle', (req, res, next) => wishlistController.toggleItem(req, res, next));

// POST /v1/wishlist/items - Add product to wishlist
wishlistRouter.post('/items', (req, res, next) => wishlistController.addItem(req, res, next));

// POST /v1/wishlist/check - Check which products are wishlisted
wishlistRouter.post('/check', (req, res, next) => wishlistController.checkItems(req, res, next));

// DELETE /v1/wishlist/items/:productId - Remove product from wishlist
wishlistRouter.delete('/items/:productId', (req, res, next) => wishlistController.removeItem(req, res, next));
