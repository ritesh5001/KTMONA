import { Router } from 'express';
import { productController } from '../controllers/product.controller.js';
import { reviewController } from '../controllers/review.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { askQuestionSchema, productReportSchema, productTrustService } from '../services/product-trust.service.js';

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

/** Product Q&A: answered questions (public) and asking one (signed in). */
productRouter.get('/:id/questions', async (req, res, next) => {
    try {
        res.set('Cache-Control', 'public, max-age=60');
        res.json(await productTrustService.listQuestions(String(req.params['id'])));
    } catch (error) {
        next(error);
    }
});
productRouter.post('/:id/questions', authenticate, async (req, res, next) => {
    try {
        const { question } = askQuestionSchema.parse(req.body);
        res.status(201).json(await productTrustService.ask(String(req.params['id']), req.user!.userId, question));
    } catch (error) {
        next(error);
    }
});

/** Report incorrect product information. */
productRouter.post('/:id/report', authenticate, async (req, res, next) => {
    try {
        res.json(await productTrustService.report(String(req.params['id']), req.user!.userId, productReportSchema.parse(req.body)));
    } catch (error) {
        next(error);
    }
});

export { productRouter };
