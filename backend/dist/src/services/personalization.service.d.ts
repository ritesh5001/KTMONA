export interface RecentlyViewedProduct {
    id: string;
    title: string;
    description: string | null;
    images: string[];
    sellerPrice: number;
    adminListingPrice: number | null;
    isPublished: boolean;
    category: {
        id: string;
        name: string;
    } | null;
    viewedAt: number;
}
export declare class PersonalizationService {
    /**
     * Track a product view for a user.
     *
     * Uses ZADD with the current timestamp as score (idempotent — re-viewing
     * the same product just updates the timestamp).
     * Then trims the set to the most recent MAX_ITEMS entries.
     */
    trackRecentlyViewed(userId: string, productId: string): Promise<void>;
    /**
     * Fetch the user's recently viewed products (most recent first).
     *
     * Returns enriched product objects from Prisma joined with the Redis
     * timestamps, ordered by most-recently-viewed.
     */
    getRecentlyViewed(userId: string): Promise<RecentlyViewedProduct[]>;
}
export declare const personalizationService: PersonalizationService;
//# sourceMappingURL=personalization.service.d.ts.map