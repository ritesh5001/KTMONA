export interface AnalyticsSummary {
    totalRevenue: number;
    totalOrders: number;
    totalUnitsSold: number;
    averageOrderValue: number;
    totalRefundAmount: number;
    netRevenue: number;
    returnRate: number;
    cancellationRate: number;
    conversionRate: number;
}
export interface ChartPoint {
    date: string;
    revenue: number;
}
export interface TopProduct {
    productId: string;
    title: string;
    image: string | null;
    unitsSold: number;
    revenue: number;
    returnCount: number;
    ratingAverage: number;
}
export interface InventoryHealth {
    lowStockProducts: number;
    outOfStockProducts: number;
    totalVariants: number;
    fastMovingProducts: Array<{
        productId: string;
        title: string;
        image: string | null;
        unitsSold: number;
    }>;
}
export interface RefundImpactData {
    totalRefunds: number;
    refundRevenueImpact: number;
    mostReturnedProducts: Array<{
        productId: string;
        title: string;
        returnCount: number;
        refundAmount: number;
    }>;
}
declare class SellerAnalyticsService {
    getSummary(sellerId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsSummary>;
    getRevenueChart(sellerId: string, interval: 'daily' | 'weekly' | 'monthly'): Promise<ChartPoint[]>;
    getTopProducts(sellerId: string, limit?: number): Promise<TopProduct[]>;
    getInventoryHealth(sellerId: string): Promise<InventoryHealth>;
    getRefundImpact(sellerId: string, startDate?: Date, endDate?: Date): Promise<RefundImpactData>;
}
export declare const sellerAnalyticsService: SellerAnalyticsService;
export {};
//# sourceMappingURL=sellerAnalytics.service.d.ts.map