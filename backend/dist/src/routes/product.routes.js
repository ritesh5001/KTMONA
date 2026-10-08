import { Router } from 'express';
import { productController } from '../controllers/product.controller.js';
import { reviewController } from '../controllers/review.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
/**
 * Product Routes
 * Base path: /v1/products
 * All routes are PUBLIC (no auth required) unless noted
 */
const productRouter = Router();
// ============================================================================
// PUBLIC ROUTES
// ============================================================================
/**
 * GET /v1/products
 * List published products with pagination
 */
productRouter.get('/', productController.listProducts);
/**
 * GET /v1/products/:id
 * Get product by ID with full details
 */
productRouter.get('/:id', productController.getProduct);
// ============================================================================
// PRODUCT REVIEWS
// ============================================================================
/**
 * GET /v1/products/:id/reviews
 * Get reviews for a product (Public)
 */
productRouter.get('/:id/reviews', reviewController.getProductReviews);
/**
 * POST /v1/products/:id/reviews
 * Create a review for a product (Authenticated)
 */
productRouter.post('/:id/reviews', authenticate, reviewController.createReview);
export { productRouter };
//# sourceMappingURL=product.routes.js.map