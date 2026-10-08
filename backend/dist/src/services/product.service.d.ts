import { ProductRepository } from '../repositories/product.repository.js';
import { VariantRepository } from '../repositories/variant.repository.js';
import { InventoryRepository } from '../repositories/inventory.repository.js';
import { CategoryRepository } from '../repositories/category.repository.js';
import { OccasionService } from './occasion.service.js';
import type { ProductQueryFilters, ProductListResponse, ProductDetailResponse, SellerProductListResponse, ProductCreateResponse, ProductUpdateResponse, ProductDeleteResponse, VariantCreateResponse, VariantUpdateResponse, StockUpdateResponse, CreateProductRequest, UpdateProductRequest, CreateVariantRequest, UpdateVariantRequest } from '../types/product.types.js';
/**
 * Product Service
 * Business logic for product, variant, and inventory operations
 */
export declare class ProductService {
    private readonly productRepo;
    private readonly variantRepo;
    private readonly inventoryRepo;
    private readonly categoryRepo;
    private readonly occasionSvc;
    constructor(productRepo: ProductRepository, variantRepo: VariantRepository, inventoryRepo: InventoryRepository, categoryRepo: CategoryRepository, occasionSvc: OccasionService);
    private toNumber;
    private roundMoney;
    private calculateDiscountedPrice;
    private getBestCouponPreview;
    private resolveCheapestVariant;
    private resolveListingPricing;
    private resolveDetailPricing;
    private getActiveCouponsForSellers;
    private toPublicProduct;
    private toPublicProductDetail;
    private toSellerProduct;
    private validateCreateVariantPayload;
    private validateUpdateVariantPayload;
    private ensureProductVariantUniqueness;
    private normalizeTextFilter;
    private normalizeListFilters;
    private publishProductFreshness;
    /**
     * List published products with pagination
     * Uses Redis caching
     */
    listProducts(filters: ProductQueryFilters): Promise<ProductListResponse>;
    /**
     * Get product by ID with full details
     * Uses Redis caching
     */
    getProductById(id: string): Promise<ProductDetailResponse>;
    /**
     * Create a new product (seller only)
     */
    createProduct(sellerId: string, data: CreateProductRequest): Promise<ProductCreateResponse>;
    /**
     * List seller's own products
     * No caching (private data)
     */
    listSellerProducts(sellerId: string, params?: {
        page?: number;
        limit?: number;
    }): Promise<SellerProductListResponse>;
    /**
     * Update a product (seller only, ownership enforced)
     */
    updateProduct(productId: string, sellerId: string, data: UpdateProductRequest): Promise<ProductUpdateResponse>;
    /**
     * Delete a product (seller only, ownership enforced)
     */
    deleteProduct(productId: string, sellerId: string): Promise<ProductDeleteResponse>;
    /**
     * Add a variant to a product (seller only, ownership enforced)
     */
    addVariant(productId: string, sellerId: string, data: CreateVariantRequest): Promise<VariantCreateResponse>;
    /**
     * Update a variant (seller only, ownership enforced)
     */
    updateVariant(variantId: string, sellerId: string, data: UpdateVariantRequest): Promise<VariantUpdateResponse>;
    /**
     * Update stock for a variant (seller only, ownership enforced)
     */
    updateStock(variantId: string, sellerId: string, stock: number): Promise<StockUpdateResponse>;
}
export declare const productService: ProductService;
//# sourceMappingURL=product.service.d.ts.map