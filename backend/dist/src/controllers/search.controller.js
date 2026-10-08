import { searchService } from '../services/search.service.js';
import { z } from 'zod';
// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------
const searchQuerySchema = z.object({
    q: z.string().min(1, 'Search query is required').max(200),
    page: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1))
        .optional()
        .default('1'),
    limit: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1).max(20))
        .optional()
        .default('20'),
    categoryId: z.string().optional(),
    sort: z
        .enum(['relevance', 'price_asc', 'price_desc', 'newest', 'popularity'])
        .optional()
        .default('relevance'),
});
const suggestQuerySchema = z.object({
    q: z.string().min(2, 'Query must be at least 2 characters').max(100),
    limit: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1).max(20))
        .optional()
        .default('8'),
});
const trendingQuerySchema = z.object({
    limit: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1).max(20))
        .optional()
        .default('10'),
});
const relatedParamsSchema = z.object({
    id: z.string().min(1, 'Product ID is required'),
});
const relatedQuerySchema = z.object({
    limit: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1).max(20))
        .optional()
        .default('8'),
});
// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export class SearchController {
    /**
     * GET /v1/search?q=...&page=&limit=&categoryId=&sort=
     */
    search = async (req, res, next) => {
        try {
            const filters = searchQuerySchema.parse(req.query);
            const result = await searchService.searchProducts({
                q: filters.q,
                page: filters.page,
                limit: filters.limit,
                categoryId: filters.categoryId,
                sort: filters.sort,
            });
            res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /v1/search/suggest?q=...&limit=
     */
    suggest = async (req, res, next) => {
        try {
            const { q, limit } = suggestQuerySchema.parse(req.query);
            const suggestions = await searchService.getSuggestions(q, limit);
            res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
            res.json({ suggestions });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /v1/search/trending?limit=
     */
    trending = async (req, res, next) => {
        try {
            const { limit } = trendingQuerySchema.parse(req.query);
            const trending = await searchService.getTrending(limit);
            res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
            res.json({ trending });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /v1/products/:id/related?limit=
     */
    relatedProducts = async (req, res, next) => {
        try {
            const { id } = relatedParamsSchema.parse(req.params);
            const { limit } = relatedQuerySchema.parse(req.query);
            const related = await searchService.getRelatedProducts(id, limit);
            res.set('Cache-Control', 'public, max-age=180, stale-while-revalidate=900');
            res.json({ data: related });
        }
        catch (error) {
            next(error);
        }
    };
}
export const searchController = new SearchController();
//# sourceMappingURL=search.controller.js.map