import { CartRepository } from '../repositories/cart.repository.js';
import { VariantRepository } from '../repositories/variant.repository.js';
import type { CartResponse, CartItemResponse, CartItemDeleteResponse, AddCartItemRequest } from '../types/cart.types.js';
/**
 * Cart Service
 * Business logic for shopping cart operations
 */
export declare class CartService {
    private readonly cartRepo;
    private readonly variantRepo;
    constructor(cartRepo: CartRepository, variantRepo: VariantRepository);
    /**
     * Get user's cart with items
     * Uses Redis caching
     */
    getCart(userId: string): Promise<CartResponse>;
    /**
     * Add item to cart
     * Validates stock availability and snapshots price
     */
    addItem(userId: string, data: AddCartItemRequest): Promise<CartItemResponse>;
    /**
     * Update cart item quantity
     * Validates stock availability
     */
    updateItem(userId: string, itemId: string, quantity: number): Promise<CartItemResponse>;
    /**
     * Remove item from cart
     */
    removeItem(userId: string, itemId: string): Promise<CartItemDeleteResponse>;
}
export declare const cartService: CartService;
//# sourceMappingURL=cart.service.d.ts.map