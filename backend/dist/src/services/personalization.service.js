import { redis } from '../config/redis.js';
import { prisma } from '../config/db.js';
import { personalizationLogger } from '../config/logger.js';
import { recentlyViewedTrackTotal, recentlyViewedFetchTotal, } from '../config/metrics.js';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_ITEMS = 20;
const KEY_PREFIX = 'recently_viewed:';
const CATEGORY_AFFINITY_KEY_PREFIX = 'user_category_affinity:';
function redisKey(userId) {
    return `${KEY_PREFIX}${userId}`;
}
function categoryAffinityKey(userId) {
    return `${CATEGORY_AFFINITY_KEY_PREFIX}${userId}`;
}
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export class PersonalizationService {
    /**
     * Track a product view for a user.
     *
     * Uses ZADD with the current timestamp as score (idempotent — re-viewing
     * the same product just updates the timestamp).
     * Then trims the set to the most recent MAX_ITEMS entries.
     */
    async trackRecentlyViewed(userId, productId) {
        const key = redisKey(userId);
        const score = Date.now();
        const [, , product] = await Promise.all([
            redis.zadd(key, { score, member: productId }),
            redis.zremrangebyrank(key, 0, -(MAX_ITEMS + 1)),
            prisma.product.findUnique({
                where: { id: productId },
                select: { categoryId: true },
            }),
        ]);
        if (product?.categoryId) {
            redis
                .zincrby(categoryAffinityKey(userId), 1, product.categoryId)
                .catch(() => { });
        }
        recentlyViewedTrackTotal.inc();
        personalizationLogger.info({ userId, productId, categoryId: product?.categoryId ?? null }, 'tracked recently viewed');
    }
    /**
     * Fetch the user's recently viewed products (most recent first).
     *
     * Returns enriched product objects from Prisma joined with the Redis
     * timestamps, ordered by most-recently-viewed.
     */
    async getRecentlyViewed(userId) {
        recentlyViewedFetchTotal.inc();
        const key = redisKey(userId);
        // ZRANGE with REV gives highest-score-first (most recent).
        // Upstash returns the members; we also need scores.
        const raw = await redis.zrange(key, 0, MAX_ITEMS - 1, { rev: true, withScores: true });
        // raw comes as interleaved [member, score, member, score, ...]
        if (!raw || raw.length === 0) {
            personalizationLogger.debug({ userId, count: 0 }, 'recently viewed empty');
            return [];
        }
        const entries = [];
        for (let i = 0; i < raw.length; i += 2) {
            entries.push({
                productId: String(raw[i]),
                score: Number(raw[i + 1]),
            });
        }
        const productIds = entries.map((e) => e.productId);
        // Fetch product details from DB
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                isPublished: true,
                deletedByAdmin: false,
            },
            select: {
                id: true,
                title: true,
                description: true,
                images: true,
                sellerPrice: true,
                adminListingPrice: true,
                isPublished: true,
                category: { select: { id: true, name: true } },
            },
        });
        // Build a map for O(1) lookup
        const productMap = new Map(products.map((p) => [p.id, p]));
        // Preserve Redis sort order, skip products that are no longer published
        const result = [];
        for (const entry of entries) {
            const p = productMap.get(entry.productId);
            if (!p)
                continue;
            result.push({
                id: p.id,
                title: p.title,
                description: p.description ?? null,
                images: p.images ?? [],
                sellerPrice: Number(p.sellerPrice ?? 0),
                adminListingPrice: p.adminListingPrice != null ? Number(p.adminListingPrice) : null,
                isPublished: p.isPublished,
                category: p.category,
                viewedAt: entry.score,
            });
        }
        personalizationLogger.debug({ userId, count: result.length }, 'fetched recently viewed');
        return result;
    }
}
// Singleton
export const personalizationService = new PersonalizationService();
//# sourceMappingURL=personalization.service.js.map