import { Router } from 'express';
import { productController } from '../controllers/product.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

/**
 * Seller Product Routes
 * Base path: /v1/seller/products
 * All routes require SELLER role
 */
const sellerProductRouter = Router();

// Apply authentication and role check to all routes
sellerProductRouter.use(authenticate, authorize('SELLER'));

// ============================================================================
// PRODUCT CRUD
// ============================================================================

/**
 * POST /v1/seller/products
 * Create a new product
 */
sellerProductRouter.post('/', productController.createProduct);

/**
 * GET /v1/seller/products
 * List seller's own products
 */
sellerProductRouter.get('/', productController.listSellerProducts);

/**
 * PUT /v1/seller/products/:id
 * Update a product
 */
sellerProductRouter.put('/:id', productController.updateProduct);

/**
 * DELETE /v1/seller/products/:id
 * Delete a product
 */
sellerProductRouter.delete('/:id', productController.deleteProduct);

// ============================================================================
// VARIANT MANAGEMENT
// ============================================================================

/**
 * POST /v1/seller/products/:id/variants
 * Add a variant to a product
 */
sellerProductRouter.post('/:id/variants', productController.addVariant);

/**
 * PUT /v1/seller/products/variants/:id
 * Update a variant
 */
sellerProductRouter.put('/variants/:id', productController.updateVariant);

/**
 * PUT /v1/seller/products/variants/:id/stock
 * Update stock for a variant
 */
sellerProductRouter.put('/variants/:id/stock', productController.updateStock);

export { sellerProductRouter };
