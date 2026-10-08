/**
 * Cache key constants for all domains
 */
export declare const CACHE_KEYS: {
    readonly CATEGORIES_LIST: "categories:list";
    readonly PRODUCTS_LIST: "products:list";
    readonly PRODUCTS_LIST_FILTERED: (page: number, limit: number, categoryId?: string, search?: string, occasion?: string) => string;
    readonly PRODUCT_DETAIL: (id: string) => string;
    readonly SELLER_PRODUCTS: (sellerId: string, page: number, limit: number) => string;
    readonly BESTSELLERS_LIST: "products:bestsellers";
    readonly BUYER_ORDERS: (userId: string, page: number, limit: number, start?: string, end?: string) => string;
    readonly BUYER_ORDER_DETAIL: (userId: string, orderId: string) => string;
    readonly SELLER_ORDERS: (sellerId: string, page: number, limit: number, start?: string, end?: string) => string;
    readonly SELLER_ORDER_DETAIL: (sellerId: string, orderId: string) => string;
    readonly USER_ADDRESSES: (userId: string) => string;
    readonly USER_WISHLIST: (userId: string) => string;
    readonly USER_WISHLIST_COUNT: (userId: string) => string;
    readonly USER_NOTIFICATIONS: (userId: string, page: number, limit: number) => string;
    readonly USER_UNREAD_NOTIFICATIONS: (userId: string) => string;
    readonly USER_CANCELLATIONS: (userId: string) => string;
    readonly ADMIN_CANCELLATIONS: (status?: string, userId?: string, orderId?: string) => string;
    readonly USER_RETURNS: (userId: string) => string;
    readonly ADMIN_RETURNS: (status?: string, userId?: string, orderId?: string) => string;
    readonly OCCASIONS_LIST: "occasions:list";
    readonly SEARCH_RESULTS: (q: string, page: number, limit: number, categoryId?: string, sort?: string) => string;
    readonly SEARCH_SUGGESTIONS: (q: string, limit: number) => string;
    readonly SEARCH_RELATED: (productId: string, limit: number) => string;
    readonly CART: (userId: string) => string;
    readonly ORDER_DETAIL: (orderId: string) => string;
    readonly PRODUCT_REVIEWS: (productId: string, page: number, limit: number, sort: string) => string;
    readonly RECOMMENDATIONS: (userId: string) => string;
    readonly REELS_PUBLIC: (page: number, limit: number, category?: string) => string;
    readonly ADMIN_STATS: "admin:stats";
    readonly ADMIN_PROFIT_SUMMARY: (start?: string, end?: string, limit?: number) => string;
    readonly ADMIN_ORDERS: "admin:orders:list";
    readonly ADMIN_PAYMENTS: "admin:payments:list";
    readonly TRACKING: (orderId: string) => string;
    readonly SELLER_ANALYTICS_SUMMARY: (sellerId: string, start?: string, end?: string) => string;
    readonly SELLER_ANALYTICS_CHART: (sellerId: string, interval: string) => string;
    readonly SELLER_ANALYTICS_TOP_PRODUCTS: (sellerId: string, limit: number) => string;
    readonly SELLER_ANALYTICS_INVENTORY: (sellerId: string) => string;
    readonly SELLER_ANALYTICS_REFUND: (sellerId: string, start?: string, end?: string) => string;
};
/**
 * Get data from cache
 * @returns Cached data or null if not found
 */
export declare function getFromCache<T>(key: string): Promise<T | null>;
/**
 * Set data in cache with optional TTL
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
 */
export declare function setCache<T>(key: string, data: T, ttlSeconds?: number): Promise<void>;
/**
 * Delete specific cache keys
 * @param keys - Keys to invalidate
 */
export declare function invalidateCache(...keys: string[]): Promise<void>;
export declare function invalidateCacheByPattern(pattern: string): Promise<void>;
/**
 * Invalidate all product-related caches
 * Used after product mutations
 */
export declare function invalidateProductCaches(productId?: string): Promise<void>;
export declare function invalidateUserPrivateCaches(userId: string): Promise<void>;
export declare function invalidateSellerPrivateCaches(sellerId: string): Promise<void>;
/**
 * Invalidate category cache
 */
export declare function invalidateCategoryCache(): Promise<void>;
//# sourceMappingURL=cache.util.d.ts.map