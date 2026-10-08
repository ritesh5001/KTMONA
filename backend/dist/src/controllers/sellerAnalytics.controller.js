import { sellerAnalyticsService } from '../services/sellerAnalytics.service.js';
/**
 * Seller Analytics Controller
 *
 * All handlers require authenticated SELLER role (enforced at route level).
 */
class SellerAnalyticsController {
    /** GET /v1/seller/analytics/summary */
    async getSummary(req, res, next) {
        try {
            const sellerId = req.user.userId;
            const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
            if (startDate && endDate && startDate > endDate) {
                res.status(400).json({ success: false, error: { message: 'startDate must be before endDate' } });
                return;
            }
            const data = await sellerAnalyticsService.getSummary(sellerId, startDate, endDate);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    /** GET /v1/seller/analytics/revenue-chart */
    async getRevenueChart(req, res, next) {
        try {
            const sellerId = req.user.userId;
            const interval = req.query.interval || 'daily';
            const data = await sellerAnalyticsService.getRevenueChart(sellerId, interval);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    /** GET /v1/seller/analytics/top-products */
    async getTopProducts(req, res, next) {
        try {
            const sellerId = req.user.userId;
            const limit = req.query.limit ? Number(req.query.limit) : 10;
            const data = await sellerAnalyticsService.getTopProducts(sellerId, limit);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    /** GET /v1/seller/analytics/inventory-health */
    async getInventoryHealth(req, res, next) {
        try {
            const sellerId = req.user.userId;
            const data = await sellerAnalyticsService.getInventoryHealth(sellerId);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    /** GET /v1/seller/analytics/refund-impact */
    async getRefundImpact(req, res, next) {
        try {
            const sellerId = req.user.userId;
            const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
            const data = await sellerAnalyticsService.getRefundImpact(sellerId, startDate, endDate);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
}
export const sellerAnalyticsController = new SellerAnalyticsController();
//# sourceMappingURL=sellerAnalytics.controller.js.map