import { recommendationService } from '../services/recommendation.service.js';
export class RecommendationController {
    /**
     * GET /v1/personalization/recommendations
     */
    async getRecommendations(req, res, next) {
        try {
            const userId = req.user.userId;
            const products = await recommendationService.getRecommendations(userId);
            res.json({ products });
        }
        catch (error) {
            next(error);
        }
    }
}
export const recommendationController = new RecommendationController();
//# sourceMappingURL=recommendation.controller.js.map