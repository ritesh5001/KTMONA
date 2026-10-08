import type { OrderEntity, OrderWithItems, OrderWithDetails, CreateOrderRequest, SellerOrderItem, OrderItemWithProduct } from '../types/order.types.js';
/**
 * Order Repository
 * Handles database operations for orders
 */
export declare class OrderRepository {
    /**
     * Create order with items (used within transaction)
     */
    create(data: CreateOrderRequest): Promise<OrderWithItems>;
    /**
     * Find order by ID
     */
    findById(id: string): Promise<OrderEntity | null>;
    /**
     * Find order by ID and user ID (buyer ownership check)
     */
    findByIdAndUserId(id: string, userId: string): Promise<OrderWithDetails | null>;
    /**
     * Find all orders for a user (buyer)
     */
    findByUserId(userId: string, params?: {
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<OrderWithItems[]>;
    /**
     * Find order items for a seller
     * Uses batch lookups instead of N+1 queries
     */
    findBySellerId(sellerId: string, params?: {
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<SellerOrderItem[]>;
    /**
     * Find order items for a specific order belonging to seller
     */
    findSellerOrderById(orderId: string, sellerId: string): Promise<{
        order: {
            id: string;
            status: string;
            createdAt: Date;
        } | null;
        items: OrderItemWithProduct[];
    }>;
    /**
     * Helper to enrich order items with product/variant details
     * Uses batch lookups (2 queries total) instead of 2N individual queries.
     */
    private enrichOrderItems;
}
export declare const orderRepository: OrderRepository;
//# sourceMappingURL=order.repository.d.ts.map