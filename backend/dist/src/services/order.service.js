import { orderRepository } from '../repositories/order.repository.js';
import { ApiError } from '../errors/ApiError.js';
import { CACHE_KEYS, getFromCache, setCache } from '../utils/cache.util.js';
const PRIVATE_ORDER_CACHE_TTL_SECONDS = 30;
function dateSegment(date) {
    return date ? date.toISOString() : undefined;
}
/**
 * Order Service
 * Business logic for order viewing (buyer and seller)
 */
export class OrderService {
    orderRepo;
    constructor(orderRepo) {
        this.orderRepo = orderRepo;
    }
    // =========================================================================
    // BUYER METHODS
    // =========================================================================
    /**
     * List buyer's orders
     * Uses Redis caching
     */
    async listBuyerOrders(userId, params) {
        const page = Math.max(1, Math.trunc(params?.page ?? 1));
        const limit = Math.min(20, Math.max(1, Math.trunc(params?.limit ?? 20)));
        const cacheKey = CACHE_KEYS.BUYER_ORDERS(userId, page, limit, dateSegment(params?.startDate), dateSegment(params?.endDate));
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const orders = await this.orderRepo.findByUserId(userId, { ...params, page, limit });
        const response = { orders };
        await setCache(cacheKey, response, PRIVATE_ORDER_CACHE_TTL_SECONDS);
        return response;
    }
    /**
     * Get buyer's order detail
     * Uses Redis caching
     */
    async getBuyerOrder(orderId, userId) {
        const cacheKey = CACHE_KEYS.BUYER_ORDER_DETAIL(userId, orderId);
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const order = await this.orderRepo.findByIdAndUserId(orderId, userId);
        if (!order) {
            throw ApiError.notFound('Order not found');
        }
        const response = { order };
        await setCache(cacheKey, response, PRIVATE_ORDER_CACHE_TTL_SECONDS);
        return response;
    }
    // =========================================================================
    // SELLER METHODS
    // =========================================================================
    /**
     * List seller's order items
     * No caching (frequently changing data)
     */
    async listSellerOrders(sellerId, params) {
        const page = Math.max(1, Math.trunc(params?.page ?? 1));
        const limit = Math.min(20, Math.max(1, Math.trunc(params?.limit ?? 20)));
        const cacheKey = CACHE_KEYS.SELLER_ORDERS(sellerId, page, limit, dateSegment(params?.startDate), dateSegment(params?.endDate));
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const orderItems = await this.orderRepo.findBySellerId(sellerId, { ...params, page, limit });
        const response = { orderItems };
        await setCache(cacheKey, response, PRIVATE_ORDER_CACHE_TTL_SECONDS);
        return response;
    }
    /**
     * Get seller's view of an order (only their items)
     */
    async getSellerOrder(orderId, sellerId) {
        const cacheKey = CACHE_KEYS.SELLER_ORDER_DETAIL(sellerId, orderId);
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const result = await this.orderRepo.findSellerOrderById(orderId, sellerId);
        if (!result.order) {
            throw ApiError.notFound('Order not found');
        }
        if (result.items.length === 0) {
            throw ApiError.forbidden('No items in this order belong to you');
        }
        const response = {
            orderId: result.order.id,
            status: result.order.status,
            createdAt: result.order.createdAt,
            items: result.items,
        };
        await setCache(cacheKey, response, PRIVATE_ORDER_CACHE_TTL_SECONDS);
        return response;
    }
}
// Export singleton instance
export const orderService = new OrderService(orderRepository);
//# sourceMappingURL=order.service.js.map