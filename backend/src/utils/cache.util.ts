import {
    getCache,
    setCache as setCacheSafe,
    deleteCache,
    clearCache,
} from './cache.js';

/**
 * Cache key constants for all domains
 */
export const CACHE_KEYS = {
    // Category & Product domain
    CATEGORIES_LIST: 'categories:list',
    PRODUCTS_LIST: 'products:list',
    PRODUCTS_LIST_FILTERED: (page: number, limit: number, categoryId?: string, search?: string, occasion?: string) =>
        `products:list:${page}:${limit}:${categoryId ?? '_'}:${search ?? '_'}:${occasion ?? '_'}`,
    PRODUCT_DETAIL: (id: string) => `products:detail:${id}`,
    SELLER_PRODUCTS: (sellerId: string, page: number, limit: number) => `products:seller:${sellerId}:${page}:${limit}`,
    BESTSELLERS_LIST: 'products:bestsellers',

    // Auth-scoped dashboard/list reads. Keep TTLs short and always key by owner.
    BUYER_ORDERS: (userId: string, page: number, limit: number, start?: string, end?: string) =>
        `orders:buyer:${userId}:${page}:${limit}:${start ?? '_'}:${end ?? '_'}`,
    BUYER_ORDER_DETAIL: (userId: string, orderId: string) => `orders:buyer:${userId}:detail:${orderId}`,
    SELLER_ORDERS: (sellerId: string, page: number, limit: number, start?: string, end?: string) =>
        `orders:seller:${sellerId}:${page}:${limit}:${start ?? '_'}:${end ?? '_'}`,
    SELLER_ORDER_DETAIL: (sellerId: string, orderId: string) => `orders:seller:${sellerId}:detail:${orderId}`,
    USER_ADDRESSES: (userId: string) => `addresses:user:${userId}`,
    USER_WISHLIST: (userId: string) => `wishlist:user:${userId}`,
    USER_WISHLIST_COUNT: (userId: string) => `wishlist:user:${userId}:count`,
    USER_NOTIFICATIONS: (userId: string, page: number, limit: number) => `notifications:user:${userId}:${page}:${limit}`,
    USER_UNREAD_NOTIFICATIONS: (userId: string) => `notifications:user:${userId}:unread`,
    USER_CANCELLATIONS: (userId: string) => `cancellations:user:${userId}`,
    ADMIN_CANCELLATIONS: (status?: string, userId?: string, orderId?: string) =>
        `cancellations:admin:${status ?? '_'}:${userId ?? '_'}:${orderId ?? '_'}`,
    USER_RETURNS: (userId: string) => `returns:user:${userId}`,
    ADMIN_RETURNS: (status?: string, userId?: string, orderId?: string) =>
        `returns:admin:${status ?? '_'}:${userId ?? '_'}:${orderId ?? '_'}`,

    // Occasions domain
    OCCASIONS_LIST: 'occasions:list',

    // Search domain
    SEARCH_RESULTS: (q: string, page: number, limit: number, categoryId?: string, sort?: string) =>
        `search:${q}:${page}:${limit}:${categoryId ?? '_'}:${sort ?? 'relevance'}`,
    SEARCH_SUGGESTIONS: (q: string, limit: number) => `search:suggest:${q}:${limit}`,
    SEARCH_RELATED: (productId: string, limit: number) => `search:related:${productId}:${limit}`,

    // Cart & Orders domain
    CART: (userId: string) => `cart:${userId}`,
    ORDER_DETAIL: (orderId: string) => `orders:detail:${orderId}`,

    // Review domain
    PRODUCT_REVIEWS: (productId: string, page: number, limit: number, sort: string) =>
        `reviews:${productId}:${page}:${limit}:${sort}`,

    // Recommendation domain
    RECOMMENDATIONS: (userId: string) => `recommendations:${userId}`,

    // Reels domain
    REELS_PUBLIC: (page: number, limit: number, category?: string) => `reels:public:${page}:${limit}:${category ?? '_'}`,

    // Admin domain
    ADMIN_STATS: 'admin:stats',
    ADMIN_PROFIT_SUMMARY: (start?: string, end?: string, limit?: number) =>
        `admin:profit:${start ?? '_'}:${end ?? '_'}:${limit ?? 20}`,
    ADMIN_ORDERS: 'admin:orders:list',
    ADMIN_PAYMENTS: 'admin:payments:list',

    // Shipping domain
    TRACKING: (orderId: string) => `tracking:${orderId}`,

    // Seller Analytics domain
    SELLER_ANALYTICS_SUMMARY: (sellerId: string, start?: string, end?: string) =>
        `seller:analytics:summary:${sellerId}:${start ?? '_'}:${end ?? '_'}`,
    SELLER_ANALYTICS_CHART: (sellerId: string, interval: string) =>
        `seller:analytics:chart:${sellerId}:${interval}`,
    SELLER_ANALYTICS_TOP_PRODUCTS: (sellerId: string, limit: number) =>
        `seller:analytics:top-products:${sellerId}:${limit}`,
    SELLER_ANALYTICS_INVENTORY: (sellerId: string) =>
        `seller:analytics:inventory:${sellerId}`,
    SELLER_ANALYTICS_REFUND: (sellerId: string, start?: string, end?: string) =>
        `seller:analytics:refund:${sellerId}:${start ?? '_'}:${end ?? '_'}`,
} as const;

/**
 * Default cache TTL in seconds (5 minutes)
 */
const DEFAULT_TTL = 300;

/**
 * Get data from cache
 * @returns Cached data or null if not found
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
    return getCache<T>(key);
}

/**
 * Set data in cache with optional TTL
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
 */
export async function setCache<T>(
    key: string,
    data: T,
    ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
    await setCacheSafe(key, data, ttlSeconds);
}

/**
 * Delete specific cache keys
 * @param keys - Keys to invalidate
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
        await deleteCache(keys);
    }
}

export async function invalidateCacheByPattern(pattern: string): Promise<void> {
    await clearCache(pattern);
}

/**
 * Invalidate all product-related caches
 * Used after product mutations
 */
export async function invalidateProductCaches(productId?: string): Promise<void> {
    const tasks: Promise<void>[] = [
        invalidateCache(CACHE_KEYS.PRODUCTS_LIST),
        invalidateCacheByPattern('products:list:*'),
        invalidateCacheByPattern('products:seller:*'),
        invalidateCacheByPattern('search:*'),
    ];

    if (productId) {
        tasks.push(
            invalidateCache(CACHE_KEYS.PRODUCT_DETAIL(productId)),
            invalidateCacheByPattern(`reviews:${productId}:*`),
            invalidateCacheByPattern(`search:related:${productId}:*`),
        );
    }

    await Promise.allSettled(tasks);
}

export async function invalidateUserPrivateCaches(userId: string): Promise<void> {
    await Promise.allSettled([
        invalidateCacheByPattern(`orders:buyer:${userId}:*`),
        invalidateCacheByPattern(`addresses:user:${userId}*`),
        invalidateCacheByPattern(`wishlist:user:${userId}*`),
        invalidateCacheByPattern(`notifications:user:${userId}:*`),
        invalidateCacheByPattern(`cancellations:user:${userId}*`),
        invalidateCacheByPattern(`returns:user:${userId}*`),
    ]);
}

export async function invalidateSellerPrivateCaches(sellerId: string): Promise<void> {
    await Promise.allSettled([
        invalidateCacheByPattern(`orders:seller:${sellerId}:*`),
        invalidateCacheByPattern(`products:seller:${sellerId}:*`),
        invalidateCacheByPattern(`seller:analytics:*:${sellerId}:*`),
        invalidateCacheByPattern(`seller:analytics:*:${sellerId}`),
    ]);
}

/**
 * Invalidate category cache
 */
export async function invalidateCategoryCache(): Promise<void> {
    await invalidateCache(CACHE_KEYS.CATEGORIES_LIST);
}
