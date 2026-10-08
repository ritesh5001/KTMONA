import { OrderRepository } from '../repositories/order.repository.js';
import type { BuyerOrderListResponse, BuyerOrderDetailResponse, SellerOrderListResponse, SellerOrderDetailResponse } from '../types/order.types.js';
/**
 * Order Service
 * Business logic for order viewing (buyer and seller)
 */
export declare class OrderService {
    private readonly orderRepo;
    constructor(orderRepo: OrderRepository);
    /**
     * List buyer's orders
     * Uses Redis caching
     */
    listBuyerOrders(userId: string, params?: {
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<BuyerOrderListResponse>;
    /**
     * Get buyer's order detail
     * Uses Redis caching
     */
    getBuyerOrder(orderId: string, userId: string): Promise<BuyerOrderDetailResponse>;
    /**
     * List seller's order items
     * No caching (frequently changing data)
     */
    listSellerOrders(sellerId: string, params?: {
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<SellerOrderListResponse>;
    /**
     * Get seller's view of an order (only their items)
     */
    getSellerOrder(orderId: string, sellerId: string): Promise<SellerOrderDetailResponse>;
}
export declare const orderService: OrderService;
//# sourceMappingURL=order.service.d.ts.map