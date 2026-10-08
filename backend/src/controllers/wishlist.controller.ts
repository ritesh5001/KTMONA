import type { Request, Response, NextFunction } from 'express';
import { wishlistService } from '../services/wishlist.service.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const productIdParamSchema = z.object({
    productId: z.string().min(1, 'productId is required'),
});

const checkItemsSchema = z.object({
    productIds: z.array(z.string().min(1)).min(1).max(50),
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class WishlistController {
    /**
     * GET /v1/wishlist
     * List all products in the user's wishlist.
     */
    async getWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const result = await wishlistService.getWishlist(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /v1/wishlist/toggle
     * Toggle a product in/out of the wishlist.
     * Body: { productId: string }
     */
    async toggleItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const { productId } = productIdParamSchema.parse(req.body);
            const result = await wishlistService.toggleItem(userId, productId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /v1/wishlist/items
     * Explicitly add a product to the wishlist.
     * Body: { productId: string }
     */
    async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const { productId } = productIdParamSchema.parse(req.body);
            const result = await wishlistService.addItem(userId, productId);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /v1/wishlist/items/:productId
     * Remove a product from the wishlist.
     */
    async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const productId = req.params.productId as string;
            const result = await wishlistService.removeItem(userId, productId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /v1/wishlist/count
     * Get the total number of items in the user's wishlist.
     */
    async getCount(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const result = await wishlistService.getCount(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /v1/wishlist/check
     * Check which of the given product IDs are wishlisted.
     * Body: { productIds: string[] }
     */
    async checkItems(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const { productIds } = checkItemsSchema.parse(req.body);
            const result = await wishlistService.checkItems(userId, productIds);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
}

export const wishlistController = new WishlistController();
