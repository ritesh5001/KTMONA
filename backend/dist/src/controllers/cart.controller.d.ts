import type { Request, Response, NextFunction } from 'express';
/**
 * Cart Controller
 * Handles HTTP requests for shopping cart operations
 */
export declare class CartController {
    /**
     * Get user's cart
     * GET /v1/cart
     */
    getCart(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Add item to cart
     * POST /v1/cart/items
     */
    addItem(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update cart item quantity
     * PUT /v1/cart/items/:id
     */
    updateItem(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Remove item from cart
     * DELETE /v1/cart/items/:id
     */
    removeItem(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const cartController: CartController;
//# sourceMappingURL=cart.controller.d.ts.map