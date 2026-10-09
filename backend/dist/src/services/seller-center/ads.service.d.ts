/**
 * KTMONA Ads: sponsored products, cost-per-click with a daily budget cap.
 * Spend is rolled up daily into the seller ledger and deducted from payouts.
 */
export declare const MIN_BID = 1;
export declare const MIN_DAILY_BUDGET = 50;
declare class SellerAdsService {
    listCampaigns(sellerId: string, query: Record<string, unknown>): Promise<{
        days: number;
        minBid: number;
        minDailyBudget: number;
        totals: {
            ctr: number;
            roas: number;
            impressions: number;
            clicks: number;
            spend: number;
            orders: number;
            revenue: number;
        };
        daily: {
            date: Date;
            impressions: number;
            clicks: number;
            spend: number;
            orders: number;
        }[];
        campaigns: {
            spend: number;
            revenue: number;
            ctr: number;
            roas: number;
            impressions: number;
            clicks: number;
            orders: number;
            id: string;
            name: string;
            status: import(".prisma/client").AdCampaignStatus;
            dailyBudget: number;
            bidPerClick: number;
            startsAt: Date;
            endsAt: Date | null;
            productCount: number;
            productIds: string[];
            spentToday: number;
        }[];
    }>;
    createCampaign(sellerId: string, input: {
        name: string;
        dailyBudget: number;
        bidPerClick: number;
        startsAt?: Date | undefined;
        endsAt?: Date | null | undefined;
        productIds: string[];
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        sellerId: string;
        name: string;
        dailyBudget: number;
        bidPerClick: number;
        startsAt: Date;
        endsAt: Date | null;
        status: import(".prisma/client").AdCampaignStatus;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    updateCampaign(sellerId: string, id: string, input: {
        name?: string | undefined;
        dailyBudget?: number | undefined;
        bidPerClick?: number | undefined;
        endsAt?: Date | null | undefined;
        status?: 'ACTIVE' | 'PAUSED' | 'ENDED' | undefined;
        productIds?: string[] | undefined;
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        sellerId: string;
        name: string;
        dailyBudget: number;
        bidPerClick: number;
        startsAt: Date;
        endsAt: Date | null;
        status: import(".prisma/client").AdCampaignStatus;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    private validate;
    /**
     * Pick sponsored products for a storefront slot. Highest bid first among
     * campaigns that still have budget today; records one impression each.
     */
    sponsored(opts: {
        categoryId?: string | undefined;
        search?: string | undefined;
        limit?: number | undefined;
        excludeIds?: string[] | undefined;
    }): Promise<{
        adCampaignId: string;
        id: string;
        title: string;
        images: string[];
        category: {
            id: string;
            name: string;
        };
        price: number | null;
        compareAtPrice: number | null;
        sponsored: boolean;
    }[]>;
    /** Record a click and charge the bid (within today's budget). */
    click(campaignId: string, productId: string): Promise<{
        charged: number;
    }>;
    /**
     * Attribute an order to ads: any advertised product clicked in the last
     * 7 days that appears in the order counts as an ad order.
     */
    attributeOrder(orderId: string): Promise<void>;
    /** Roll ad spend into the ledger (one negative entry per campaign per day). */
    rollupSpendToLedger(): Promise<{
        entries: number;
    }>;
}
export declare const sellerAdsService: SellerAdsService;
export {};
//# sourceMappingURL=ads.service.d.ts.map