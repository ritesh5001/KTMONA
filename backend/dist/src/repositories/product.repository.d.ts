import { prisma } from '../config/db.js';
import type { ProductEntity, ProductWithCategory, ProductWithDetails, CreateProductRequest, UpdateProductRequest, ProductQueryFilters } from '../types/product.types.js';
type ProductTx = typeof prisma;
/**
 * Product Repository
 * Handles database operations for products
 */
export declare class ProductRepository {
    private resolvePagination;
    private mapProductDecimals;
    private mapVariantFields;
    private mapProductWithVariants;
    syncVariantSummary(productId: string, tx?: ProductTx): Promise<ProductEntity>;
    /**
     * Find published products with pagination and filters
     */
    findPublished(filters: ProductQueryFilters): Promise<{
        products: ProductWithCategory[];
        total: number;
    }>;
    /**
     * Find published product by ID with full details
     */
    findPublishedById(id: string): Promise<ProductWithDetails | null>;
    /**
     * Find all products for a seller
     */
    findBySellerId(sellerId: string, params?: {
        page?: number;
        limit?: number;
    }): Promise<ProductWithDetails[]>;
    /**
     * Find product by ID and seller (ownership check)
     */
    findByIdAndSeller(id: string, sellerId: string): Promise<ProductEntity | null>;
    /**
     * Find product by ID with details
     */
    findByIdWithDetails(id: string): Promise<ProductWithDetails | null>;
    /**
     * Create a new product with inline variants
     */
    create(sellerId: string, data: CreateProductRequest): Promise<ProductEntity>;
    /**
     * Update a product
     */
    update(id: string, data: UpdateProductRequest): Promise<ProductEntity>;
    /**
     * Delete a product
     */
    delete(id: string): Promise<void>;
    /**
     * Check if product exists
     */
    exists(id: string): Promise<boolean>;
}
export declare const productRepository: ProductRepository;
export {};
//# sourceMappingURL=product.repository.d.ts.map