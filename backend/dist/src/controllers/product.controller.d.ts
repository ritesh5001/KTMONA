import type { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service.js';
/**
 * Product Controller
 * Handles HTTP layer for product endpoints
 */
export declare class ProductController {
    private readonly service;
    constructor(service: ProductService);
    /**
     * Handle Zod validation errors
     */
    private handleZodError;
    private parsePositiveInt;
    /**
     * GET /v1/products
     * List published products with pagination
     */
    listProducts: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/products/:id
     * Get product by ID with full details
     */
    getProduct: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/seller/products
     * Create a new product
     */
    createProduct: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/seller/products
     * List seller's own products
     */
    listSellerProducts: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/seller/products/:id
     * Update a product
     */
    updateProduct: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /v1/seller/products/:id
     * Delete a product
     */
    deleteProduct: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/seller/products/:id/variants
     * Add a variant to a product
     */
    addVariant: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/seller/variants/:id
     * Update a variant
     */
    updateVariant: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/seller/variants/:id/stock
     * Update stock for a variant
     */
    updateStock: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const productController: ProductController;
//# sourceMappingURL=product.controller.d.ts.map