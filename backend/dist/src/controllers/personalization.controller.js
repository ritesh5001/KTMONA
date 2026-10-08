import { personalizationService } from '../services/personalization.service.js';
/**
 * Personalization Controller
 * Handles recently-viewed product tracking and retrieval
 */
export class PersonalizationController {
    /**
     * Track a product view
     * POST /v1/personalization/recently-viewed/:productId
     */
    async trackView(req, res, next) {
        try {
            const userId = req.user.userId;
            const productId = req.params.productId;
            await personalizationService.trackRecentlyViewed(userId, productId);
            res.status(204).end();
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get recently viewed products
     * GET /v1/personalization/recently-viewed
     */
    async getRecentlyViewed(req, res, next) {
        try {
            const userId = req.user.userId;
            const products = await personalizationService.getRecentlyViewed(userId);
            res.json({ products });
        }
        catch (error) {
            next(error);
        }
    }
}
export const personalizationController = new PersonalizationController();
//# sourceMappingURL=personalization.controller.js.map