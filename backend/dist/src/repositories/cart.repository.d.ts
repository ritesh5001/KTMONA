import type { CartEntity, CartItemEntity, CartWithItems, AddCartItemRequest } from '../types/cart.types.js';
/**
 * One cart line joined with everything checkout needs to price and validate it.
 * Produced by CartRepository.getCartForCheckout — internal pricing use only, since
 * it carries seller cost prices that must never reach a buyer-facing response.
 */
export interface CheckoutCartRow {
    cartId: string;
    itemId: string;
    quantity: number;
    productId: string;
    variantId: string;
    productTitle: string | null;
    sellerId: string | null;
    taxRate: number | null;
    productStatus: string | null;
    productDeleted: boolean | null;
    variantPrice: number | null;
    variantSellerPrice: number | null;
    variantAdminPrice: number | null;
    variantStatus: string | null;
    stock: number;
    sellerState: string;
}
/**
 * Cart Repository
 * Handles database operations for shopping carts
 */
export declare class CartRepository {
    /**
     * Find cart by user ID with items (basic - no product/variant details)
     */
    findByUserId(userId: string): Promise<({
        items: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            cartId: string;
            productId: string;
            variantId: string;
            quantity: number;
            priceSnapshot: number;
            createdAt: Date;
        }, unknown> & {})[];
    } & import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string;
        updatedAt: Date;
    }, unknown> & {}) | null>;
    /**
     * Find or create cart for user.
     *
     * Read first: an upsert is a WRITE, and it was being paid on every single cart
     * interaction even though the row almost always already exists. The API and its
     * Postgres are in different regions, so that wasted round-trip is measured in
     * hundreds of milliseconds. Only brand-new users take the second query.
     */
    findOrCreateByUserId(userId: string): Promise<CartEntity>;
    /**
     * Add item to cart (upsert - updates quantity if exists)
     */
    addItem(cartId: string, data: AddCartItemRequest & {
        priceSnapshot: number;
    }): Promise<CartItemEntity>;
    /**
     * Find cart item by ID
     */
    findItemById(itemId: string): Promise<CartItemEntity | null>;
    /**
     * Find cart item by ID with cart (for ownership check)
     */
    findItemByIdWithCart(itemId: string): Promise<(CartItemEntity & {
        cart: CartEntity;
    }) | null>;
    /**
     * Update item quantity
     */
    updateItemQuantity(itemId: string, quantity: number, priceSnapshot: number): Promise<CartItemEntity>;
    /**
     * Remove item from cart
     */
    removeItem(itemId: string): Promise<void>;
    /**
     * Clear all items from cart
     */
    clearCart(cartId: string): Promise<void>;
    /**
     * Get cart items with product and variant details
     * Uses batch lookups (2 queries) instead of 2N individual queries.
     */
    getCartWithDetails(userId: string): Promise<CartWithItems | null>;
    /**
     * Load everything checkout needs about a cart in TWO round-trips.
     *
     * Checkout previously called getCartWithDetails() and then re-queried products
     * (for taxRate), variants (for seller/admin pricing) and seller_profiles (for the
     * seller's state) — six sequential queries where two suffice. With the database in
     * a different region than the API, each of those round-trips cost ~500ms.
     *
     * This is deliberately NOT folded into getCartWithDetails: the fields below include
     * sellerPrice and adminListingPrice, which must never reach a buyer-facing cart
     * response. Keep this method for internal pricing paths only.
     */
    getCartForCheckout(userId: string): Promise<CheckoutCartRow[]>;
}
export declare const cartRepository: CartRepository;
//# sourceMappingURL=cart.repository.d.ts.map