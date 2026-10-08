import { Router } from 'express';
import { personalizationController } from '../controllers/personalization.controller.js';
import { recommendationController } from '../controllers/recommendation.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
/**
 * Personalization Routes
 * All routes require USER role (authenticated buyers only)
 */
export const personalizationRouter = Router();
// All personalization routes require authentication and USER role
personalizationRouter.use(authenticate);
personalizationRouter.use(authorize('USER'));
// POST /v1/personalization/recently-viewed/:productId - Track a viewed product
personalizationRouter.post('/recently-viewed/:productId', (req, res, next) => personalizationController.trackView(req, res, next));
// GET /v1/personalization/recently-viewed - Get recently viewed products
personalizationRouter.get('/recently-viewed', (req, res, next) => personalizationController.getRecentlyViewed(req, res, next));
// GET /v1/personalization/recommendations - Get recommendation list
personalizationRouter.get('/recommendations', (req, res, next) => recommendationController.getRecommendations(req, res, next));
//# sourceMappingURL=personalization.routes.js.map