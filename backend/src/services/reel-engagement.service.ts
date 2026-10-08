import { ReelEngagementRepository, reelEngagementRepository } from '../repositories/reel-engagement.repository.js';
import { ReelRepository, reelRepository } from '../repositories/reel.repository.js';
import { ApiError } from '../errors/ApiError.js';

const VIEW_SPAM_WINDOW_MS = 30_000; // 1 view per 30 seconds per user per reel

export class ReelEngagementService {
    constructor(
        private readonly engagementRepo: ReelEngagementRepository,
        private readonly reelRepo: ReelRepository,
    ) {}

    // =========================================================================
    // LIKES
    // =========================================================================

    async likeReel(reelId: string, userId: string) {
        const reel = await this.reelRepo.findPublishedById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }

        const existing = await this.engagementRepo.findLike(reelId, userId);
        if (existing) {
            return { message: 'Already liked', liked: true };
        }

        await this.engagementRepo.createLike(reelId, userId);
        return { message: 'Reel liked', liked: true };
    }

    async unlikeReel(reelId: string, userId: string) {
        const reel = await this.reelRepo.findPublishedById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }

        const existing = await this.engagementRepo.findLike(reelId, userId);
        if (!existing) {
            return { message: 'Not liked', liked: false };
        }

        await this.engagementRepo.deleteLike(reelId, userId);
        return { message: 'Like removed', liked: false };
    }

    async hasLiked(reelId: string, userId: string) {
        return this.engagementRepo.hasUserLiked(reelId, userId);
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    async recordView(reelId: string, userId: string | null) {
        const reel = await this.reelRepo.findPublishedById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }

        // Spam prevention: max 1 view per 30s per authenticated user per reel
        if (userId) {
            const since = new Date(Date.now() - VIEW_SPAM_WINDOW_MS);
            const recentView = await this.engagementRepo.findRecentView(reelId, userId, since);
            if (recentView) {
                return { message: 'View already recorded', recorded: false };
            }
        }

        await this.engagementRepo.createView(reelId, userId);
        return { message: 'View recorded', recorded: true };
    }

    // =========================================================================
    // PRODUCT CLICKS
    // =========================================================================

    async recordProductClick(reelId: string, userId: string | null) {
        const reel = await this.reelRepo.findPublishedById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }
        if (!reel.product) {
            throw ApiError.badRequest('Reel has no linked product');
        }

        await this.engagementRepo.createProductClick(reelId, reel.product.id, userId);
        return { message: 'Product click recorded' };
    }

    // =========================================================================
    // ANALYTICS
    // =========================================================================

    async getReelAnalytics(reelId: string) {
        const reel = await this.reelRepo.findById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }
        return this.engagementRepo.getReelAnalytics(reelId);
    }

    async getSellerAnalytics(sellerId: string) {
        return this.engagementRepo.getSellerReelAnalytics(sellerId);
    }
}

export const reelEngagementService = new ReelEngagementService(reelEngagementRepository, reelRepository);
