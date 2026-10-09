/**
 * Performance: business insights and account health (quality score), plus
 * the late-dispatch penalty sweep.
 */
export declare const LATE_DISPATCH_PENALTY_KEY = "seller.late_dispatch_penalty";
export declare function getLateDispatchPenalty(): Promise<number>;
declare class SellerInsightsService {
    /** Account health over the last `days` days (Meesho-style quality metrics). */
    health(sellerId: string, days?: number): Promise<{
        days: number;
        score: number;
        status: string;
        orders: number;
        overdueOrders: number;
        metrics: {
            key: string;
            label: string;
            value: number | null;
            unit: string;
            target: string;
            status: "GOOD" | "AT_RISK" | "POOR" | "NO_DATA";
        }[];
        ratings: {
            average: number | null;
            count: number;
            distribution: {
                rating: number;
                count: number;
            }[];
        };
        penalties: {
            id: string;
            amount: number;
            orderId: string | null;
            note: string | null;
            date: Date;
            settled: boolean;
        }[];
        lateDispatchPenalty: number;
        tips: string[];
    }>;
    /** Business insights: trends, category mix, products to push or fix. */
    business(sellerId: string, days?: number): Promise<{
        days: number;
        summary: {
            revenue: number;
            revenueChange: number | null;
            orders: number;
            ordersChange: number | null;
            units: number;
            unitsChange: number | null;
            avgOrderValue: number;
        };
        trend: {
            date: Date;
            revenue: number;
            units: number;
        }[];
        categories: {
            category: string;
            units: number;
            revenue: number;
        }[];
        topProducts: {
            productId: string;
            title: string;
            image: string | null;
            category: string;
            live: boolean;
            stock: number;
            units: number;
            revenue: number;
            unitsChange: number | null;
            wishlisted: number;
            reviews: number;
            daysOfCover: number | null;
            ageDays: number;
        }[];
        restock: {
            productId: string;
            title: string;
            image: string | null;
            category: string;
            live: boolean;
            stock: number;
            units: number;
            revenue: number;
            unitsChange: number | null;
            wishlisted: number;
            reviews: number;
            daysOfCover: number | null;
            ageDays: number;
        }[];
        notSelling: {
            productId: string;
            title: string;
            image: string | null;
            category: string;
            live: boolean;
            stock: number;
            units: number;
            revenue: number;
            unitsChange: number | null;
            wishlisted: number;
            reviews: number;
            daysOfCover: number | null;
            ageDays: number;
        }[];
        highDemand: {
            productId: string;
            title: string;
            image: string | null;
            category: string;
            live: boolean;
            stock: number;
            units: number;
            revenue: number;
            unitsChange: number | null;
            wishlisted: number;
            reviews: number;
            daysOfCover: number | null;
            ageDays: number;
        }[];
        recommendations: {
            title: string;
            detail: string;
            action: string;
            href: string;
        }[];
    }>;
    /**
     * Record a penalty for each sub-order shipped after its dispatch date.
     * Charges only when an admin has set a penalty amount (> 0).
     */
    runLateDispatchPenalties(): Promise<{
        created: number;
    }>;
}
export declare const sellerInsightsService: SellerInsightsService;
export {};
//# sourceMappingURL=insights.service.d.ts.map