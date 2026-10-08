import type { NextFunction, Request, Response } from 'express';
export declare class RecommendationController {
    /**
     * GET /v1/personalization/recommendations
     */
    getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const recommendationController: RecommendationController;
//# sourceMappingURL=recommendation.controller.d.ts.map