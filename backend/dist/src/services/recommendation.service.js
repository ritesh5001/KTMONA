import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import { recommendationLogger } from '../config/logger.js';
import { recommendationCandidateCount, recommendationGenerationTimeMs, recommendationRequestTotal, } from '../config/metrics.js';
import { CACHE_KEYS, getFromCache, setCache } from '../utils/cache.util.js';
const RECENTLY_VIEWED_KEY_PREFIX = 'recently_viewed:';
const CATEGORY_AFFINITY_KEY_PREFIX = 'user_category_affinity:';
const MAX_RESULTS = 20;
const CANDIDATE_FETCH_LIMIT = 200;
function recentlyViewedKey(userId) {
    return `${RECENTLY_VIEWED_KEY_PREFIX}${userId}`;
}
function categoryAffinityKey(userId) {
    return `${CATEGORY_AFFINITY_KEY_PREFIX}${userId}`;
}
function bumpFrequency(map, categoryId, weight) {
    map.set(categoryId, (map.get(categoryId) ?? 0) + weight);
}
export function scoreRecommendationCandidate(params) {
    const affinity = Number.isFinite(params.affinityScore) ? params.affinityScore : 0;
    const recentBoost = params.recentlyViewedRank >= 0 ? Math.max(0, 5 - params.recentlyViewedRank * 0.25) : 0;
    return params.categoryFrequency * 10 + affinity * 2 + recentBoost;
}
export class RecommendationService {
    async getRecommendations(userId) {
        const cacheKey = CACHE_KEYS.RECOMMENDATIONS(userId);
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const startedAt = performance.now();
        recommendationRequestTotal.inc();
        const wishlistItemsPromise = prisma.wishlistItem.findMany({
            where: { wishlist: { userId } },
            select: {
                productId: true,
                product: { select: { categoryId: true } },
            },
            take: 500,
        });
        const purchasedOrderItemsPromise = prisma.orderItem.findMany({
            where: {
                order: {
                    userId,
                    status: { not: 'CANCELLED' },
                },
            },
            select: { productId: true },
            take: 100,
        });
        const recentlyViewedIdsPromise = redis.zrange(recentlyViewedKey(userId), 0, 49, { rev: true });
        const affinityRawPromise = redis.zrange(categoryAffinityKey(userId), 0, 50, { rev: true, withScores: true });
        const [wishlistItems, purchasedOrderItems, recentlyViewedIdsRaw, affinityRaw] = await Promise.all([
            wishlistItemsPromise,
            purchasedOrderItemsPromise,
            recentlyViewedIdsPromise,
            affinityRawPromise,
        ]);
        const wishlistProductIds = new Set(wishlistItems.map((item) => item.productId));
        const purchasedProductIds = new Set(purchasedOrderItems.map((item) => item.productId));
        const recentlyViewedIds = (recentlyViewedIdsRaw ?? []).map(String);
        const categoryFrequency = new Map();
        for (const item of wishlistItems) {
            if (item.product?.categoryId) {
                bumpFrequency(categoryFrequency, item.product.categoryId, 3);
            }
        }
        const [purchasedProducts, recentlyViewedProducts] = await Promise.all([
            purchasedProductIds.size
                ? prisma.product.findMany({
                    where: { id: { in: Array.from(purchasedProductIds) } },
                    select: { categoryId: true },
                })
                : Promise.resolve([]),
            recentlyViewedIds.length
                ? prisma.product.findMany({
                    where: { id: { in: recentlyViewedIds } },
                    select: { id: true, categoryId: true },
                })
                : Promise.resolve([]),
        ]);
        for (const product of purchasedProducts) {
            bumpFrequency(categoryFrequency, product.categoryId, 5);
        }
        const recentlyViewedCategoryByProduct = new Map(recentlyViewedProducts.map((p) => [p.id, p.categoryId]));
        for (const productId of recentlyViewedIds) {
            const categoryId = recentlyViewedCategoryByProduct.get(productId);
            if (categoryId) {
                bumpFrequency(categoryFrequency, categoryId, 1);
            }
        }
        const affinityByCategory = new Map();
        if (affinityRaw && affinityRaw.length > 0) {
            for (let index = 0; index < affinityRaw.length; index += 2) {
                affinityByCategory.set(String(affinityRaw[index]), Number(affinityRaw[index + 1]));
            }
        }
        // Affinity contributes to category preference even if that category has no
        // recent explicit events in this request window.
        for (const [categoryId, affinityScore] of affinityByCategory.entries()) {
            bumpFrequency(categoryFrequency, categoryId, affinityScore);
        }
        const categoryIds = Array.from(categoryFrequency.keys());
        if (categoryIds.length === 0) {
            recommendationGenerationTimeMs.observe(performance.now() - startedAt);
            recommendationCandidateCount.observe(0);
            recommendationLogger.info({
                userId,
                candidateCount: 0,
                resultCount: 0,
                executionTime: Math.round(performance.now() - startedAt),
            }, 'recommendations_generated');
            return [];
        }
        const excludedIds = new Set([
            ...wishlistProductIds,
            ...purchasedProductIds,
        ]);
        const candidatesRaw = await prisma.product.findMany({
            where: {
                categoryId: { in: categoryIds },
                isPublished: true,
                deletedByAdmin: false,
                status: 'APPROVED',
                ...(excludedIds.size > 0 ? { id: { notIn: Array.from(excludedIds) } } : {}),
            },
            select: {
                id: true,
                title: true,
                description: true,
                images: true,
                sellerPrice: true,
                adminListingPrice: true,
                categoryId: true,
                createdAt: true,
                category: { select: { id: true, name: true } },
            },
            take: CANDIDATE_FETCH_LIMIT,
        });
        const candidates = candidatesRaw.map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            description: candidate.description ?? null,
            images: candidate.images ?? [],
            sellerPrice: Number(candidate.sellerPrice ?? 0),
            adminListingPrice: candidate.adminListingPrice != null ? Number(candidate.adminListingPrice) : null,
            categoryId: candidate.categoryId,
            category: candidate.category,
            createdAt: candidate.createdAt,
        }));
        recommendationCandidateCount.observe(candidates.length);
        const viewedRankByProductId = new Map();
        recentlyViewedIds.forEach((productId, index) => viewedRankByProductId.set(productId, index));
        const scored = candidates.map((candidate) => {
            const categoryFrequencyScore = categoryFrequency.get(candidate.categoryId) ?? 0;
            const affinityScore = affinityByCategory.get(candidate.categoryId) ?? 0;
            const viewedRank = viewedRankByProductId.get(candidate.id) ?? -1;
            const score = scoreRecommendationCandidate({
                categoryFrequency: categoryFrequencyScore,
                affinityScore,
                recentlyViewedRank: viewedRank,
            });
            return { candidate, score };
        });
        // Deterministic ordering:
        // 1. Higher score first
        // 2. Newer product first
        // 3. Lexicographically smaller product ID first (stable tie-break)
        scored.sort((a, b) => {
            if (b.score !== a.score)
                return b.score - a.score;
            if (b.candidate.createdAt.getTime() !== a.candidate.createdAt.getTime()) {
                return b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime();
            }
            return a.candidate.id.localeCompare(b.candidate.id);
        });
        const results = scored.slice(0, MAX_RESULTS).map(({ candidate, score }) => ({
            id: candidate.id,
            title: candidate.title,
            description: candidate.description,
            images: candidate.images,
            sellerPrice: candidate.sellerPrice,
            adminListingPrice: candidate.adminListingPrice,
            category: candidate.category,
            recommendationScore: score,
        }));
        const executionTime = performance.now() - startedAt;
        recommendationGenerationTimeMs.observe(executionTime);
        recommendationLogger.info({
            userId,
            candidateCount: candidates.length,
            resultCount: results.length,
            executionTime: Math.round(executionTime),
        }, 'recommendations_generated');
        await setCache(cacheKey, results, 60);
        return results;
    }
}
export const recommendationService = new RecommendationService();
//# sourceMappingURL=recommendation.service.js.map