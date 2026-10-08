import type { NextFunction, Request, Response } from 'express';
import { recommendationService } from '../services/recommendation.service.js';

export class RecommendationController {
    /**
     * GET /v1/personalization/recommendations
     */
    async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const products = await recommendationService.getRecommendations(userId);
            res.json({ products });
        } catch (error) {
            next(error);
        }
    }
}

export const recommendationController = new RecommendationController();
