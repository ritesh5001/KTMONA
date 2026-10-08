export interface WishlistItemDetail {
    id: string;
    productId: string;
    createdAt: string;
    product: {
        id: string;
        title: string;
        description: string | null;
        images: string[];
        sellerPrice: number | null;
        adminListingPrice: number | null;
        isPublished: boolean;
        category: {
            id: string;
            name: string;
        } | null;
    };
}
export interface WishlistResponse {
    wishlist: {
        id: string;
        userId: string;
        items: WishlistItemDetail[];
    };
}
export interface WishlistToggleResponse {
    message: string;
    added: boolean;
    productId: string;
}
export interface WishlistCountResponse {
    count: number;
}
export declare class WishlistService {
    /**
     * Get or create the user's wishlist (idempotent).
     */
    private findOrCreateWishlist;
    /**
     * List all wishlist items with product details.
     */
    getWishlist(userId: string): Promise<WishlistResponse>;
    /**
     * Toggle a product in the wishlist using an idempotent upsert / delete.
     * Returns whether the item was added or removed.
     */
    toggleItem(userId: string, productId: string): Promise<WishlistToggleResponse>;
    /**
     * Explicitly add a product to the wishlist (idempotent).
     */
    addItem(userId: string, productId: string): Promise<WishlistToggleResponse>;
    /**
     * Explicitly remove a product from the wishlist (idempotent).
     */
    removeItem(userId: string, productId: string): Promise<WishlistToggleResponse>;
    /**
     * Get total wishlist item count.
     */
    getCount(userId: string): Promise<WishlistCountResponse>;
    /**
     * Check if specific product IDs are in the user's wishlist.
     * Returns a set of product IDs that ARE in the wishlist.
     */
    checkItems(userId: string, productIds: string[]): Promise<{
        wishlisted: string[];
    }>;
}
export declare const wishlistService: WishlistService;
//# sourceMappingURL=wishlist.service.d.ts.map