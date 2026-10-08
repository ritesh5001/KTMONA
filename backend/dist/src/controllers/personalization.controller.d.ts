import type { Request, Response, NextFunction } from 'express';
/**
 * Personalization Controller
 * Handles recently-viewed product tracking and retrieval
 */
export declare class PersonalizationController {
    /**
     * Track a product view
     * POST /v1/personalization/recently-viewed/:productId
     */
    trackView(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get recently viewed products
     * GET /v1/personalization/recently-viewed
     */
    getRecentlyViewed(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const personalizationController: PersonalizationController;
//# sourceMappingURL=personalization.controller.d.ts.map