import type { Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service.js';
import { addCartItemSchema, updateCartItemSchema } from '../validators/cart.validation.js';

/**
 * Cart Controller
 * Handles HTTP requests for shopping cart operations
 */
export class CartController {
    /**
     * Get user's cart
     * GET /v1/cart
     */
    async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const result = await cartService.getCart(userId);
            res.set('Cache-Control', 'no-store');
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Add item to cart
     * POST /v1/cart/items
     */
    async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const validated = addCartItemSchema.parse(req.body);
            const result = await cartService.addItem(userId, validated);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update cart item quantity
     * PUT /v1/cart/items/:id
     */
    async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const itemId = req.params.id as string;
            const validated = updateCartItemSchema.parse(req.body);
            const result = await cartService.updateItem(userId, itemId, validated.quantity);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Remove item from cart
     * DELETE /v1/cart/items/:id
     */
    async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const itemId = req.params.id as string;
            const result = await cartService.removeItem(userId, itemId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
}

// Export singleton instance
export const cartController = new CartController();
