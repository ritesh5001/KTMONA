import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import { ApiError } from '../errors/ApiError.js';
import { searchLogger } from '../config/logger.js';
import { CACHE_KEYS, getFromCache, setCache } from '../utils/cache.util.js';
import { searchQueryTotal, searchNoResultTotal, autocompleteTotal, searchDurationSeconds, } from '../config/metrics.js';
// ---------------------------------------------------------------------------
// Redis key
// ---------------------------------------------------------------------------
const TRENDING_KEY = 'search:trending';
const MAX_SEARCH_LIMIT = 20;
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export class SearchService {
    normalizeQuery(input) {
        return input.trim().replace(/\s+/g, ' ');
    }
    // -----------------------------------------------------------------------
    // Full-text search with tsvector + ts_rank
    // -----------------------------------------------------------------------
    async searchProducts(filters) {
        const timer = searchDurationSeconds.startTimer();
        const normalizedQ = this.normalizeQuery(filters.q);
        const page = Math.max(1, Math.trunc(filters.page || 1));
        const categoryId = filters.categoryId?.trim() || undefined;
        const sort = filters.sort ?? 'relevance';
        const safeLimit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(filters.limit || 20)));
        const cacheKey = CACHE_KEYS.SEARCH_RESULTS(normalizedQ.toLowerCase(), page, safeLimit, categoryId, sort);
        const cached = await getFromCache(cacheKey);
        if (cached) {
            timer();
            return cached;
        }
        const offset = (page - 1) * safeLimit;
        searchQueryTotal.inc();
        try {
            // Track in Redis trending
            this.trackTrending(normalizedQ).catch(() => { });
            // Build WHERE clause pieces
            const conditions = [
                `p."is_published" = true`,
                `p."deleted_by_admin" = false`,
                `p."admin_listing_price" IS NOT NULL`,
                `p."search_vector" @@ plainto_tsquery('english', $1)`,
            ];
            const params = [normalizedQ];
            let paramIndex = 2;
            if (categoryId) {
                conditions.push(`p."category_id" = $${paramIndex}`);
                params.push(categoryId);
                paramIndex++;
            }
            const whereClause = conditions.join(' AND ');
            // Build ORDER BY and rank expression
            let orderBy;
            let rankSelect = `ts_rank(p."search_vector", plainto_tsquery('english', $1)) AS rank`;
            let joins = '';
            switch (sort) {
                case 'price_asc':
                    orderBy = `COALESCE(p."admin_listing_price", p."seller_price") ASC`;
                    break;
                case 'price_desc':
                    orderBy = `COALESCE(p."admin_listing_price", p."seller_price") DESC`;
                    break;
                case 'newest':
                    orderBy = `p."created_at" DESC`;
                    break;
                case 'popularity':
                    joins = `
                LEFT JOIN (
                    SELECT pv."product_id" AS "productId", COUNT(*)::int AS "orderCount"
                    FROM "order_items" oi
                    INNER JOIN "product_variants" pv ON pv."id" = oi."variant_id"
                    GROUP BY pv."product_id"
                ) oic ON oic."productId" = p."id"
                LEFT JOIN (
                    SELECT wi."product_id" AS "productId", COUNT(*)::int AS "wishlistCount"
                    FROM "wishlist_items" wi
                    GROUP BY wi."product_id"
                ) wic ON wic."productId" = p."id"`;
                    rankSelect = `(COALESCE(oic."orderCount", 0) + COALESCE(wic."wishlistCount", 0))::float AS rank`;
                    orderBy = `(COALESCE(oic."orderCount", 0) + COALESCE(wic."wishlistCount", 0)) DESC, p."created_at" DESC`;
                    break;
                default: // 'relevance'
                    orderBy = `ts_rank(p."search_vector", plainto_tsquery('english', $1)) DESC`;
                    break;
            }
            // Count
            const countQuery = `
                SELECT COUNT(*)::int AS total
                FROM "products" p
                WHERE ${whereClause}
            `;
            // Data query
            const dataQuery = `
                SELECT
                    p."id",
                    p."title",
                    p."description",
                    p."images",
                    p."category_id" AS "categoryId",
                    p."admin_listing_price" AS "adminListingPrice",
                    p."is_published" AS "isPublished",
                    p."created_at" AS "createdAt",
                    ${rankSelect},
                    json_build_object('id', c."id", 'name', c."name") AS category
                FROM "products" p
                LEFT JOIN "categories" c ON c."id" = p."category_id"
                ${joins}
                WHERE ${whereClause}
                ORDER BY ${orderBy}
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;
            const countParams = [...params];
            const dataParams = [...params, safeLimit, offset];
            const [countResult, rows] = await Promise.all([
                prisma.$queryRawUnsafe(countQuery, ...countParams),
                prisma.$queryRawUnsafe(dataQuery, ...dataParams),
            ]);
            const total = countResult[0]?.total ?? 0;
            if (total === 0) {
                searchNoResultTotal.inc();
                searchLogger.info({ q: normalizedQ, categoryId, total: 0 }, 'search returned zero results');
                timer();
                const emptyResponse = {
                    data: [],
                    pagination: { page, limit: safeLimit, total: 0, totalPages: 0 },
                };
                await setCache(cacheKey, emptyResponse, 45);
                return emptyResponse;
            }
            // Convert Decimal values to numbers for JSON serialization
            const data = rows.map((row) => ({
                ...row,
                adminListingPrice: row.adminListingPrice != null ? Number(row.adminListingPrice) : null,
                rank: row.rank != null ? Number(row.rank) : undefined,
            }));
            const totalPages = Math.ceil(total / safeLimit);
            searchLogger.info({ q: normalizedQ, categoryId, sort, total, page }, 'search executed');
            timer();
            const response = { data, pagination: { page, limit: safeLimit, total, totalPages } };
            await setCache(cacheKey, response, 180);
            return response;
        }
        catch (error) {
            timer();
            searchLogger.error({ q: normalizedQ, error }, 'search query failed');
            throw error;
        }
    }
    // -----------------------------------------------------------------------
    // Autocomplete (ILIKE prefix match)
    // -----------------------------------------------------------------------
    async getSuggestions(q, limit = 8) {
        autocompleteTotal.inc();
        const normalizedQ = this.normalizeQuery(q);
        if (normalizedQ.length < 2) {
            return [];
        }
        const safeLimit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(limit || 8)));
        const cacheKey = CACHE_KEYS.SEARCH_SUGGESTIONS(normalizedQ.toLowerCase(), safeLimit);
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const containsPattern = `%${normalizedQ}%`;
        const prefixPattern = `${normalizedQ}%`;
        const fuzzyPrefix = normalizedQ.length >= 4 ? `${normalizedQ.slice(0, 3)}%` : null;
        const rows = await prisma.$queryRawUnsafe(`SELECT
                                p."id",
                                p."title",
                                c."name" AS "categoryName"
                         FROM "products" p
                         LEFT JOIN "categories" c ON c."id" = p."category_id"
                         WHERE p."is_published" = true
                             AND p."deleted_by_admin" = false
                             AND p."admin_listing_price" IS NOT NULL
                             AND (
                                     p."title" ILIKE $1
                                     OR p."title" ILIKE $2
                                     OR c."name" ILIKE $2
                                     OR c."slug" ILIKE $2
                                     OR EXISTS (
                                             SELECT 1
                                             FROM "product_occasions" po
                                             INNER JOIN "occasions" o ON o."id" = po."occasion_id"
                                             WHERE po."product_id" = p."id"
                                                 AND o."is_active" = true
                                                 AND (o."name" ILIKE $2 OR o."slug" ILIKE $2)
                                     )
                                     OR (
                                             $3::text IS NOT NULL
                                             AND (
                                                     p."title" ILIKE $3
                                                     OR c."name" ILIKE $3
                                                     OR c."slug" ILIKE $3
                                                     OR EXISTS (
                                                             SELECT 1
                                                             FROM "product_occasions" po
                                                             INNER JOIN "occasions" o ON o."id" = po."occasion_id"
                                                             WHERE po."product_id" = p."id"
                                                                 AND o."is_active" = true
                                                                 AND (o."name" ILIKE $3 OR o."slug" ILIKE $3)
                                                     )
                                             )
                                     )
                             )
                         ORDER BY
                             CASE
                                 WHEN p."title" ILIKE $1 THEN 0
                                 WHEN c."name" ILIKE $1 THEN 1
                                 WHEN EXISTS (
                                         SELECT 1
                                         FROM "product_occasions" po
                                         INNER JOIN "occasions" o ON o."id" = po."occasion_id"
                                         WHERE po."product_id" = p."id"
                                             AND o."is_active" = true
                                             AND (o."name" ILIKE $1 OR o."slug" ILIKE $1)
                                 ) THEN 2
                                 WHEN p."title" ILIKE $2 THEN 3
                                 ELSE 4
                             END,
                             p."title" ASC
                         LIMIT $4`, prefixPattern, containsPattern, fuzzyPrefix, safeLimit);
        searchLogger.debug({ q: normalizedQ, count: rows.length }, 'autocomplete suggestions');
        const suggestions = rows.map((r) => ({
            id: r.id,
            title: r.title,
            category: r.categoryName ?? null,
        }));
        await setCache(cacheKey, suggestions, 180);
        return suggestions;
    }
    // -----------------------------------------------------------------------
    // Trending searches (Redis sorted set)
    // -----------------------------------------------------------------------
    async trackTrending(q) {
        const normalized = q.toLowerCase().trim();
        if (!normalized)
            return;
        await redis.zincrby(TRENDING_KEY, 1, normalized);
    }
    async getTrending(limit = 10) {
        const safeLimit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(limit || 10)));
        const cacheKey = `search:trending:${safeLimit}`;
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const results = await redis.zrange(TRENDING_KEY, 0, safeLimit - 1, { rev: true });
        await setCache(cacheKey, results, 120);
        return results;
    }
    // -----------------------------------------------------------------------
    // Related products
    // -----------------------------------------------------------------------
    async getRelatedProducts(productId, limit = 8) {
        const safeLimit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(limit || 8)));
        const cacheKey = CACHE_KEYS.SEARCH_RELATED(productId, safeLimit);
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        // Same category, exclude self, deterministic latest-first ordering.
        //
        // The source product's category is resolved with a subquery rather than a
        // separate findUnique. That lookup existed only to read one column, and a
        // round-trip to the database is the dominant cost of this endpoint — the
        // query itself runs in well under a millisecond.
        const rows = await prisma.$queryRawUnsafe(`SELECT
                p."id",
                p."title",
                p."description",
                p."images",
                p."category_id" AS "categoryId",
                p."admin_listing_price" AS "adminListingPrice",
                json_build_object('id', c."id", 'name', c."name") AS category
            FROM "products" p
            LEFT JOIN "categories" c ON c."id" = p."category_id"
            WHERE p."category_id" = (SELECT "category_id" FROM "products" WHERE "id" = $1)
              AND p."id" != $2
              AND p."is_published" = true
              AND p."deleted_by_admin" = false
                            AND p."admin_listing_price" IS NOT NULL
            ORDER BY p."created_at" DESC
            LIMIT $3`, productId, productId, safeLimit);
        // Only pay for an existence check when nothing came back, so a genuinely
        // missing product still 404s instead of silently returning bestsellers.
        if (rows.length === 0) {
            const exists = await prisma.product.findUnique({
                where: { id: productId },
                select: { id: true },
            });
            if (!exists) {
                throw ApiError.notFound('Product not found');
            }
        }
        // Convert decimals
        let data = rows.map((row) => ({
            ...row,
            adminListingPrice: row.adminListingPrice != null ? Number(row.adminListingPrice) : null,
        }));
        // Fallback to bestsellers if fewer than 4 found
        if (data.length < 4) {
            const fallbackRows = await prisma.$queryRawUnsafe(`SELECT
                    p."id",
                    p."title",
                    p."description",
                    p."images",
                    p."category_id" AS "categoryId",
                    p."admin_listing_price" AS "adminListingPrice",
                    json_build_object('id', c."id", 'name', c."name") AS category
                FROM "products" p
                INNER JOIN "bestsellers" b ON b."product_id" = p."id"
                LEFT JOIN "categories" c ON c."id" = p."category_id"
                WHERE p."id" != $1
                  AND p."is_published" = true
                  AND p."deleted_by_admin" = false
                                    AND p."admin_listing_price" IS NOT NULL
                ORDER BY b."position" ASC
                LIMIT $2`, productId, safeLimit - data.length);
            const existingIds = new Set(data.map((d) => d.id));
            const extra = fallbackRows
                .filter((r) => !existingIds.has(r.id))
                .map((row) => ({
                ...row,
                adminListingPrice: row.adminListingPrice != null ? Number(row.adminListingPrice) : null,
            }));
            data = [...data, ...extra].slice(0, safeLimit);
        }
        searchLogger.debug({ productId, count: data.length }, 'related products');
        await setCache(cacheKey, data, data.length === 0 ? 45 : 180);
        return data;
    }
}
// Singleton
export const searchService = new SearchService();
//# sourceMappingURL=search.service.js.map