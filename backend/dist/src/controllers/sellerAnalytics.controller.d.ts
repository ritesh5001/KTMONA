import type { Request, Response, NextFunction } from 'express';
/**
 * Seller Analytics Controller
 *
 * All handlers require authenticated SELLER role (enforced at route level).
 */
declare class SellerAnalyticsController {
    /** GET /v1/seller/analytics/summary */
    getSummary(req: Request, res: Response, next: NextFunction): Promise<void>;
    /** GET /v1/seller/analytics/revenue-chart */
    getRevenueChart(req: Request, res: Response, next: NextFunction): Promise<void>;
    /** GET /v1/seller/analytics/top-products */
    getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void>;
    /** GET /v1/seller/analytics/inventory-health */
    getInventoryHealth(req: Request, res: Response, next: NextFunction): Promise<void>;
    /** GET /v1/seller/analytics/refund-impact */
    getRefundImpact(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const sellerAnalyticsController: SellerAnalyticsController;
export {};
//# sourceMappingURL=sellerAnalytics.controller.d.ts.map