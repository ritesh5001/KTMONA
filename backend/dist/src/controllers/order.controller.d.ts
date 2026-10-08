import type { Request, Response, NextFunction } from 'express';
/**
 * Order Controller
 * Handles HTTP requests for order viewing (buyer and seller)
 */
export declare class OrderController {
    /**
     * List buyer's orders
     * GET /v1/orders
     */
    listBuyerOrders(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get buyer's order detail
     * GET /v1/orders/:id
     */
    getBuyerOrder(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Download GST-compliant invoice PDF
     * GET /v1/orders/:id/invoice
     */
    downloadInvoice(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * List seller's order items
     * GET /v1/seller/orders
     */
    listSellerOrders(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get seller's order detail
     * GET /v1/seller/orders/:id
     */
    getSellerOrder(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const orderController: OrderController;
//# sourceMappingURL=order.controller.d.ts.map