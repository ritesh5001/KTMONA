import type { Request, Response, NextFunction } from 'express';
export declare class WishlistController {
    /**
     * GET /v1/wishlist
     * List all products in the user's wishlist.
     */
    getWishlist(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /v1/wishlist/toggle
     * Toggle a product in/out of the wishlist.
     * Body: { productId: string }
     */
    toggleItem(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /v1/wishlist/items
     * Explicitly add a product to the wishlist.
     * Body: { productId: string }
     */
    addItem(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /v1/wishlist/items/:productId
     * Remove a product from the wishlist.
     */
    removeItem(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/wishlist/count
     * Get the total number of items in the user's wishlist.
     */
    getCount(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /v1/wishlist/check
     * Check which of the given product IDs are wishlisted.
     * Body: { productIds: string[] }
     */
    checkItems(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const wishlistController: WishlistController;
//# sourceMappingURL=wishlist.controller.d.ts.map