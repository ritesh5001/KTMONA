import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { sellerAnalyticsController } from '../controllers/sellerAnalytics.controller.js';
import { summaryQuerySchema, chartQuerySchema, topProductsQuerySchema, refundImpactQuerySchema, } from '../validators/sellerAnalytics.validation.js';
import { redis } from '../config/redis.js';
/**
 * Seller Analytics Routes
 * Base path: /v1/seller/analytics
 *
 * All endpoints require authenticated SELLER role.
 * Rate-limited per endpoint to reduce cross-endpoint contention.
 */
export const sellerAnalyticsRouter = Router();
// ── Global guards ────────────────────────────────────────────────────────
sellerAnalyticsRouter.use(authenticate);
sellerAnalyticsRouter.use(authorize('SELLER'));
// ── Rate limiter (per-endpoint fixed window, 60 req / 60 s) ──────────────
sellerAnalyticsRouter.use(async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            next();
            return;
        }
        const limit = 60;
        const endpoint = req.path.replace(/\//g, ':') || 'root';
        const key = `ratelimit:seller-analytics:${userId}:${endpoint}`;
        const count = await redis.incr(key);
        if (count === 1)
            await redis.expire(key, 60);
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
        if (count > limit) {
            res.setHeader('Retry-After', '60');
            res.status(429).json({
                success: false,
                error: { message: 'Too many analytics requests. Please try again in a minute.' },
            });
            return;
        }
        next();
    }
    catch {
        // If Redis is down, allow the request
        next();
    }
});
// ── Endpoints ────────────────────────────────────────────────────────────
/** GET /v1/seller/analytics/summary */
sellerAnalyticsRouter.get('/summary', validateRequest(summaryQuerySchema), (req, res, next) => sellerAnalyticsController.getSummary(req, res, next));
/** GET /v1/seller/analytics/revenue-chart */
sellerAnalyticsRouter.get('/revenue-chart', validateRequest(chartQuerySchema), (req, res, next) => sellerAnalyticsController.getRevenueChart(req, res, next));
/** GET /v1/seller/analytics/top-products */
sellerAnalyticsRouter.get('/top-products', validateRequest(topProductsQuerySchema), (req, res, next) => sellerAnalyticsController.getTopProducts(req, res, next));
/** GET /v1/seller/analytics/inventory-health */
sellerAnalyticsRouter.get('/inventory-health', (req, res, next) => sellerAnalyticsController.getInventoryHealth(req, res, next));
/** GET /v1/seller/analytics/refund-impact */
sellerAnalyticsRouter.get('/refund-impact', validateRequest(refundImpactQuerySchema), (req, res, next) => sellerAnalyticsController.getRefundImpact(req, res, next));
//# sourceMappingURL=sellerAnalytics.routes.js.map