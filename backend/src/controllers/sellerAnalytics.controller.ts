import type { Request, Response, NextFunction } from 'express';
import { sellerAnalyticsService } from '../services/sellerAnalytics.service.js';

/**
 * Seller Analytics Controller
 *
 * All handlers require authenticated SELLER role (enforced at route level).
 */
class SellerAnalyticsController {
    /** GET /v1/seller/analytics/summary */
    async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const sellerId = req.user!.userId;
            const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

            if (startDate && endDate && startDate > endDate) {
                res.status(400).json({ success: false, error: { message: 'startDate must be before endDate' } });
                return;
            }

            const data = await sellerAnalyticsService.getSummary(sellerId, startDate, endDate);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    /** GET /v1/seller/analytics/revenue-chart */
    async getRevenueChart(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const sellerId = req.user!.userId;
            const interval = (req.query.interval as string) || 'daily';
            const data = await sellerAnalyticsService.getRevenueChart(
                sellerId,
                interval as 'daily' | 'weekly' | 'monthly',
            );
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    /** GET /v1/seller/analytics/top-products */
    async getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const sellerId = req.user!.userId;
            const limit = req.query.limit ? Number(req.query.limit) : 10;
            const data = await sellerAnalyticsService.getTopProducts(sellerId, limit);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    /** GET /v1/seller/analytics/inventory-health */
    async getInventoryHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const sellerId = req.user!.userId;
            const data = await sellerAnalyticsService.getInventoryHealth(sellerId);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    /** GET /v1/seller/analytics/refund-impact */
    async getRefundImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const sellerId = req.user!.userId;
            const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
            const data = await sellerAnalyticsService.getRefundImpact(sellerId, startDate, endDate);
            res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }
}

export const sellerAnalyticsController = new SellerAnalyticsController();
