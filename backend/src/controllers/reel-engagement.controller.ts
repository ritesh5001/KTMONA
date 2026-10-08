import type { Request, Response, NextFunction } from 'express';
import { ReelEngagementService, reelEngagementService } from '../services/reel-engagement.service.js';
import { ApiError } from '../errors/ApiError.js';

function extractId(req: Request): string {
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) throw ApiError.badRequest('Reel ID is required');
    return id;
}

export class ReelEngagementController {
    constructor(private readonly service: ReelEngagementService) {}

    // =========================================================================
    // LIKES (Authenticated)
    // =========================================================================

    likeReel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) throw ApiError.unauthorized('Authentication required');
            const reelId = extractId(req);
            const result = await this.service.likeReel(reelId, req.user.userId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    unlikeReel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) throw ApiError.unauthorized('Authentication required');
            const reelId = extractId(req);
            const result = await this.service.unlikeReel(reelId, req.user.userId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    checkLiked = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) throw ApiError.unauthorized('Authentication required');
            const reelId = extractId(req);
            const liked = await this.service.hasLiked(reelId, req.user.userId);
            res.status(200).json({ liked });
        } catch (error) {
            next(error);
        }
    };

    // =========================================================================
    // VIEWS (Public, optional auth for spam prevention)
    // =========================================================================

    recordView = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const reelId = extractId(req);
            const userId = req.user?.userId ?? null;
            const result = await this.service.recordView(reelId, userId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    // =========================================================================
    // PRODUCT CLICKS (Public, optional auth)
    // =========================================================================

    recordProductClick = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const reelId = extractId(req);
            const userId = req.user?.userId ?? null;
            const result = await this.service.recordProductClick(reelId, userId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    // =========================================================================
    // SELLER ANALYTICS (Seller only)
    // =========================================================================

    getSellerAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) throw ApiError.unauthorized('Authentication required');
            const analytics = await this.service.getSellerAnalytics(req.user.userId);
            res.status(200).json({ analytics });
        } catch (error) {
            next(error);
        }
    };
}

export const reelEngagementController = new ReelEngagementController(reelEngagementService);
