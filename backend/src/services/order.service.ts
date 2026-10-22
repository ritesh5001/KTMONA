import { OrderRepository, orderRepository } from '../repositories/order.repository.js';
import { ApiError } from '../errors/ApiError.js';
import { prisma } from '../config/db.js';
import { cartService } from './cart.service.js';
import { buildBuyerOrderExtras } from './order-view.service.js';
import type {
    BuyerOrderListResponse,
    BuyerOrderDetailResponse,
    SellerOrderListResponse,
    SellerOrderDetailResponse,
    BuyerOrderFilter,
} from '../types/order.types.js';
import { CACHE_KEYS, getFromCache, setCache } from '../utils/cache.util.js';

const PRIVATE_ORDER_CACHE_TTL_SECONDS = 30;

function dateSegment(date?: Date): string | undefined {
    return date ? date.toISOString() : undefined;
}

/**
 * Order Service
 * Business logic for order viewing (buyer and seller)
 */
export class OrderService {
    constructor(private readonly orderRepo: OrderRepository) { }

    // =========================================================================
    // BUYER METHODS
    // =========================================================================

    /**
     * List buyer's orders
     * Uses Redis caching
     */
    async listBuyerOrders(
        userId: string,
        params?: {
            page?: number;
            limit?: number;
            startDate?: Date;
            endDate?: Date;
            statuses?: BuyerOrderFilter[];
        }
    ): Promise<BuyerOrderListResponse> {
        const page = Math.max(1, Math.trunc(params?.page ?? 1));
        const limit = Math.min(20, Math.max(1, Math.trunc(params?.limit ?? 20)));
        const cacheKey = CACHE_KEYS.BUYER_ORDERS(
            userId,
            page,
            limit,
            dateSegment(params?.startDate),
            dateSegment(params?.endDate),
            [...(params?.statuses ?? [])].sort().join(','),
        );
        const cached = await getFromCache<BuyerOrderListResponse>(cacheKey);
        if (cached) return cached;

        const orders = await this.orderRepo.findByUserId(userId, { ...params, page, limit });
        const response = { orders };
        await setCache(cacheKey, response, PRIVATE_ORDER_CACHE_TTL_SECONDS);
        return response;
    }

    /**
     * Get buyer's order detail
     * Uses Redis caching
     */
    async getBuyerOrder(orderId: string, userId: string): Promise<BuyerOrderDetailResponse> {
        const cacheKey = CACHE_KEYS.BUYER_ORDER_DETAIL(userId, orderId);
        const cached = await getFromCache<BuyerOrderDetailResponse>(cacheKey);
        if (cached) return cached;

        const order = await this.orderRepo.findByIdAndUserId(orderId, userId);
        if (!order) {
            throw ApiError.notFound('Order not found');
        }

        const extras = await buildBuyerOrderExtras(order);
        const response = { order: { ...order, ...extras } };
        await setCache(cacheKey, response, PRIVATE_ORDER_CACHE_TTL_SECONDS);
        return response;
    }

    /**
     * Buy again: put an order's items back in the cart (same size/colour and
     * quantity, at today's price). Items that are gone or out of stock are skipped
     * and reported; a smaller stock caps the quantity.
     */
    async reorder(orderId: string, userId: string) {
        const order = await prisma.order.findFirst({
            where: { id: orderId, userId },
            select: { items: { select: { productId: true, variantId: true, quantity: true } } },
        });
        if (!order) {
            throw ApiError.notFound('Order not found');
        }
        const result = await cartService.mergeItems(
            userId,
            order.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
        );
        return {
            ...result,
            message: result.added > 0
                ? `${result.added} item${result.added === 1 ? '' : 's'} added to your cart`
                : 'None of these items can be bought right now',
        };
    }

    // =========================================================================
    // SELLER METHODS
    // =========================================================================

    /**
     * List seller's order items
     * No caching (frequently changing data)
     */
    async listSellerOrders(
        sellerId: string,
        params?: { page?: number; limit?: number; startDate?: Date; endDate?: Date }
    ): Promise<SellerOrderListResponse> {
        const page = Math.max(1, Math.trunc(params?.page ?? 1));
        const limit = Math.min(20, Math.max(1, Math.trunc(params?.limit ?? 20)));
        const cacheKey = CACHE_KEYS.SELLER_ORDERS(
            sellerId,
            page,
            limit,
            dateSegment(params?.startDate),
            dateSegment(params?.endDate),
        );
        const cached = await getFromCache<SellerOrderListResponse>(cacheKey);
        if (cached) return cached;

        const orderItems = await this.orderRepo.findBySellerId(sellerId, { ...params, page, limit });
        const response = { orderItems };
        await setCache(cacheKey, response, PRIVATE_ORDER_CACHE_TTL_SECONDS);
        return response;
    }

    /**
     * Get seller's view of an order (only their items)
     */
    async getSellerOrder(
        orderId: string,
        sellerId: string
    ): Promise<SellerOrderDetailResponse> {
        const cacheKey = CACHE_KEYS.SELLER_ORDER_DETAIL(sellerId, orderId);
        const cached = await getFromCache<SellerOrderDetailResponse>(cacheKey);
        if (cached) return cached;

        const result = await this.orderRepo.findSellerOrderById(orderId, sellerId);

        if (!result.order) {
            throw ApiError.notFound('Order not found');
        }

        if (result.items.length === 0) {
            throw ApiError.forbidden('No items in this order belong to you');
        }

        const response = {
            orderId: result.order.id,
            status: result.order.status as any,
            createdAt: result.order.createdAt,
            items: result.items,
        };
        await setCache(cacheKey, response, PRIVATE_ORDER_CACHE_TTL_SECONDS);
        return response;
    }
}

// Export singleton instance
export const orderService = new OrderService(orderRepository);
