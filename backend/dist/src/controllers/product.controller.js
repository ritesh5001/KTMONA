import { productService } from '../services/product.service.js';
import { createProductSchema, updateProductSchema, productQuerySchema, } from '../validators/product.validation.js';
import { createVariantSchema, updateVariantSchema, updateStockSchema, } from '../validators/variant.validation.js';
import { ApiError } from '../errors/ApiError.js';
import { ZodError } from 'zod';
/**
 * Product Controller
 * Handles HTTP layer for product endpoints
 */
export class ProductController {
    service;
    constructor(service) {
        this.service = service;
    }
    /**
     * Handle Zod validation errors
     */
    handleZodError(error, next) {
        const details = error.errors.reduce((acc, err) => {
            const key = err.path.join('.');
            acc[key] = err.message;
            return acc;
        }, {});
        next(ApiError.badRequest('Validation failed', details));
    }
    parsePositiveInt(value, fallback) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1)
            return fallback;
        return Math.trunc(n);
    }
    // =========================================================================
    // PUBLIC ENDPOINTS (Buyer)
    // =========================================================================
    /**
     * GET /v1/products
     * List published products with pagination
     */
    listProducts = async (req, res, next) => {
        try {
            const filters = productQuerySchema.parse(req.query);
            const result = await this.service.listProducts(filters);
            res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
            res.status(200).json(result);
        }
        catch (error) {
            if (error instanceof ZodError) {
                this.handleZodError(error, next);
                return;
            }
            next(error);
        }
    };
    /**
     * GET /v1/products/:id
     * Get product by ID with full details
     */
    getProduct = async (req, res, next) => {
        try {
            const idParam = req.params['id'];
            const id = Array.isArray(idParam) ? idParam[0] : idParam;
            if (!id) {
                throw ApiError.badRequest('Product ID is required');
            }
            const result = await this.service.getProductById(id);
            res.set('Cache-Control', 'public, max-age=180, stale-while-revalidate=900');
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    // =========================================================================
    // SELLER ENDPOINTS
    // =========================================================================
    /**
     * POST /v1/seller/products
     * Create a new product
     */
    createProduct = async (req, res, next) => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }
            const data = createProductSchema.parse(req.body);
            const result = await this.service.createProduct(req.user.userId, data);
            res.status(201).json(result);
        }
        catch (error) {
            if (error instanceof ZodError) {
                this.handleZodError(error, next);
                return;
            }
            next(error);
        }
    };
    /**
     * GET /v1/seller/products
     * List seller's own products
     */
    listSellerProducts = async (req, res, next) => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }
            const page = this.parsePositiveInt(req.query['page'], 1);
            const limit = this.parsePositiveInt(req.query['limit'], 20);
            const result = await this.service.listSellerProducts(req.user.userId, { page, limit });
            res.set('Cache-Control', 'no-store');
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PUT /v1/seller/products/:id
     * Update a product
     */
    updateProduct = async (req, res, next) => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }
            const idParam = req.params['id'];
            const id = Array.isArray(idParam) ? idParam[0] : idParam;
            if (!id) {
                throw ApiError.badRequest('Product ID is required');
            }
            const data = updateProductSchema.parse(req.body);
            const result = await this.service.updateProduct(id, req.user.userId, data);
            res.status(200).json(result);
        }
        catch (error) {
            if (error instanceof ZodError) {
                this.handleZodError(error, next);
                return;
            }
            next(error);
        }
    };
    /**
     * DELETE /v1/seller/products/:id
     * Delete a product
     */
    deleteProduct = async (req, res, next) => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }
            const idParam = req.params['id'];
            const id = Array.isArray(idParam) ? idParam[0] : idParam;
            if (!id) {
                throw ApiError.badRequest('Product ID is required');
            }
            const result = await this.service.deleteProduct(id, req.user.userId);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /v1/seller/products/:id/variants
     * Add a variant to a product
     */
    addVariant = async (req, res, next) => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }
            const idParam = req.params['id'];
            const productId = Array.isArray(idParam) ? idParam[0] : idParam;
            if (!productId) {
                throw ApiError.badRequest('Product ID is required');
            }
            const data = createVariantSchema.parse(req.body);
            const result = await this.service.addVariant(productId, req.user.userId, data);
            res.status(201).json(result);
        }
        catch (error) {
            if (error instanceof ZodError) {
                this.handleZodError(error, next);
                return;
            }
            next(error);
        }
    };
    /**
     * PUT /v1/seller/variants/:id
     * Update a variant
     */
    updateVariant = async (req, res, next) => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }
            const idParam = req.params['id'];
            const variantId = Array.isArray(idParam) ? idParam[0] : idParam;
            if (!variantId) {
                throw ApiError.badRequest('Variant ID is required');
            }
            const data = updateVariantSchema.parse(req.body);
            const result = await this.service.updateVariant(variantId, req.user.userId, data);
            res.status(200).json(result);
        }
        catch (error) {
            if (error instanceof ZodError) {
                this.handleZodError(error, next);
                return;
            }
            next(error);
        }
    };
    /**
     * PUT /v1/seller/variants/:id/stock
     * Update stock for a variant
     */
    updateStock = async (req, res, next) => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }
            const idParam = req.params['id'];
            const variantId = Array.isArray(idParam) ? idParam[0] : idParam;
            if (!variantId) {
                throw ApiError.badRequest('Variant ID is required');
            }
            const { stock } = updateStockSchema.parse(req.body);
            const result = await this.service.updateStock(variantId, req.user.userId, stock);
            res.status(200).json(result);
        }
        catch (error) {
            if (error instanceof ZodError) {
                this.handleZodError(error, next);
                return;
            }
            next(error);
        }
    };
}
// Export singleton instance with default service
export const productController = new ProductController(productService);
//# sourceMappingURL=product.controller.js.map