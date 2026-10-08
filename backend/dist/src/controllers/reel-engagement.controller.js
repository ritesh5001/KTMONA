import { reelEngagementService } from '../services/reel-engagement.service.js';
import { ApiError } from '../errors/ApiError.js';
function extractId(req) {
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id)
        throw ApiError.badRequest('Reel ID is required');
    return id;
}
export class ReelEngagementController {
    service;
    constructor(service) {
        this.service = service;
    }
    // =========================================================================
    // LIKES (Authenticated)
    // =========================================================================
    likeReel = async (req, res, next) => {
        try {
            if (!req.user)
                throw ApiError.unauthorized('Authentication required');
            const reelId = extractId(req);
            const result = await this.service.likeReel(reelId, req.user.userId);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    unlikeReel = async (req, res, next) => {
        try {
            if (!req.user)
                throw ApiError.unauthorized('Authentication required');
            const reelId = extractId(req);
            const result = await this.service.unlikeReel(reelId, req.user.userId);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    checkLiked = async (req, res, next) => {
        try {
            if (!req.user)
                throw ApiError.unauthorized('Authentication required');
            const reelId = extractId(req);
            const liked = await this.service.hasLiked(reelId, req.user.userId);
            res.status(200).json({ liked });
        }
        catch (error) {
            next(error);
        }
    };
    // =========================================================================
    // VIEWS (Public, optional auth for spam prevention)
    // =========================================================================
    recordView = async (req, res, next) => {
        try {
            const reelId = extractId(req);
            const userId = req.user?.userId ?? null;
            const result = await this.service.recordView(reelId, userId);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    // =========================================================================
    // PRODUCT CLICKS (Public, optional auth)
    // =========================================================================
    recordProductClick = async (req, res, next) => {
        try {
            const reelId = extractId(req);
            const userId = req.user?.userId ?? null;
            const result = await this.service.recordProductClick(reelId, userId);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    // =========================================================================
    // SELLER ANALYTICS (Seller only)
    // =========================================================================
    getSellerAnalytics = async (req, res, next) => {
        try {
            if (!req.user)
                throw ApiError.unauthorized('Authentication required');
            const analytics = await this.service.getSellerAnalytics(req.user.userId);
            res.status(200).json({ analytics });
        }
        catch (error) {
            next(error);
        }
    };
}
export const reelEngagementController = new ReelEngagementController(reelEngagementService);
//# sourceMappingURL=reel-engagement.controller.js.map