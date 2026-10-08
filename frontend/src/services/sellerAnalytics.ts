import { apiRequest } from "@/services/api";

// ---------------------------------------------------------------------------
// Types (mirror backend response shapes)
// ---------------------------------------------------------------------------

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

export interface RefundImpact {
    totalRefunds: number;
    refundRevenueImpact: number;
    mostReturnedProducts: Array<{
        productId: string;
        title: string;
        returnCount: number;
        refundAmount: number;
    }>;
}

// ---------------------------------------------------------------------------
// Wrapped API response (backend envelope: { success, data })
// ---------------------------------------------------------------------------

interface ApiEnvelope<T> {
    success: boolean;
    data: T;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getAnalyticsSummary(
    startDate?: string,
    endDate?: string,
): Promise<AnalyticsSummary> {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const qs = params.toString();
    const res = await apiRequest<ApiEnvelope<AnalyticsSummary>>(
        `/v1/seller/analytics/summary${qs ? `?${qs}` : ""}`,
    );
    return res.data;
}

export async function getRevenueChart(
    interval: "daily" | "weekly" | "monthly" = "daily",
): Promise<ChartPoint[]> {
    const res = await apiRequest<ApiEnvelope<ChartPoint[]>>(
        `/v1/seller/analytics/revenue-chart?interval=${interval}`,
    );
    return res.data;
}

export async function getTopProducts(limit = 10): Promise<TopProduct[]> {
    const res = await apiRequest<ApiEnvelope<TopProduct[]>>(
        `/v1/seller/analytics/top-products?limit=${limit}`,
    );
    return res.data;
}

export async function getInventoryHealth(): Promise<InventoryHealth> {
    const res = await apiRequest<ApiEnvelope<InventoryHealth>>(
        "/v1/seller/analytics/inventory-health",
    );
    return res.data;
}

export async function getRefundImpact(
    startDate?: string,
    endDate?: string,
): Promise<RefundImpact> {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const qs = params.toString();
    const res = await apiRequest<ApiEnvelope<RefundImpact>>(
        `/v1/seller/analytics/refund-impact${qs ? `?${qs}` : ""}`,
    );
    return res.data;
}
