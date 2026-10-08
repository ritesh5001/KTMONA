import { prisma } from '../config/db.js';
const db = prisma;
export class ReelEngagementRepository {
    // =========================================================================
    // LIKES
    // =========================================================================
    async findLike(reelId, userId) {
        return db.reelLike.findUnique({
            where: { reelId_userId: { reelId, userId } },
        });
    }
    async createLike(reelId, userId) {
        return db.$transaction([
            db.reelLike.create({ data: { reelId, userId } }),
            db.reel.update({ where: { id: reelId }, data: { likes: { increment: 1 } } }),
        ]);
    }
    async deleteLike(reelId, userId) {
        return db.$transaction([
            db.reelLike.delete({ where: { reelId_userId: { reelId, userId } } }),
            db.reel.update({ where: { id: reelId }, data: { likes: { decrement: 1 } } }),
        ]);
    }
    async hasUserLiked(reelId, userId) {
        const like = await db.reelLike.findUnique({
            where: { reelId_userId: { reelId, userId } },
            select: { id: true },
        });
        return !!like;
    }
    // =========================================================================
    // VIEWS
    // =========================================================================
    async findRecentView(reelId, userId, since) {
        return db.reelView.findFirst({
            where: {
                reelId,
                userId,
                createdAt: { gte: since },
            },
            select: { id: true },
        });
    }
    async createView(reelId, userId) {
        return db.$transaction([
            db.reelView.create({ data: { reelId, userId } }),
            db.reel.update({ where: { id: reelId }, data: { views: { increment: 1 } } }),
        ]);
    }
    // =========================================================================
    // PRODUCT CLICKS
    // =========================================================================
    async createProductClick(reelId, productId, userId) {
        return db.reelProductClick.create({
            data: { reelId, productId, userId },
        });
    }
    // =========================================================================
    // ANALYTICS
    // =========================================================================
    async getReelAnalytics(reelId) {
        const [totalLikes, totalViews, totalProductClicks] = await Promise.all([
            db.reelLike.count({ where: { reelId } }),
            db.reelView.count({ where: { reelId } }),
            db.reelProductClick.count({ where: { reelId } }),
        ]);
        return { totalLikes, totalViews, totalProductClicks };
    }
    async getSellerReelAnalytics(sellerId) {
        const reels = await db.reel.findMany({
            where: { sellerId },
            select: {
                id: true,
                videoUrl: true,
                caption: true,
                status: true,
                views: true,
                likes: true,
                createdAt: true,
                product: { select: { id: true, title: true } },
                _count: { select: { reelProductClicks: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return reels.map((reel) => ({
            reelId: reel.id,
            videoUrl: reel.videoUrl,
            caption: reel.caption,
            status: reel.status,
            views: reel.views,
            likes: reel.likes,
            productClicks: reel._count.reelProductClicks,
            createdAt: reel.createdAt,
            product: reel.product,
        }));
    }
}
export const reelEngagementRepository = new ReelEngagementRepository();
//# sourceMappingURL=reel-engagement.repository.js.map