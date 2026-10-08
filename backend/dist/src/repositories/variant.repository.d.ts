import type { ProductVariantEntity, VariantWithInventory, CreateVariantRequest, UpdateVariantRequest } from '../types/product.types.js';
/**
 * Variant Repository
 * Handles database operations for product variants
 */
export declare class VariantRepository {
    private normalizeColor;
    private normalizeSize;
    private resolveEffectivePrice;
    /**
     * Create a variant with initial inventory
     */
    create(productId: string, data: CreateVariantRequest): Promise<VariantWithInventory>;
    /**
     * Find variant by ID
     */
    findById(id: string): Promise<ProductVariantEntity | null>;
    /**
     * Find variant by ID with inventory
     */
    findByIdWithInventory(id: string): Promise<VariantWithInventory | null>;
    /**
     * Find variant with product and seller info (for ownership check)
     */
    findByIdWithProduct(id: string): Promise<{
        id: string;
        productId: string;
        size: string;
        color: string | null;
        images: string[];
        sku: string;
        sellerPrice: number;
        adminListingPrice: number | null;
        price: number;
        status: string;
        compareAtPrice: number | null;
        inventory: {
            stock: number;
        } | null;
        product: {
            id: string;
            sellerId: string;
            status: string;
            deletedByAdmin: boolean;
            adminListingPrice: number | null;
        };
    } | null>;
    private buildUpdateData;
    /**
     * Update several variants in one round trip. Callers pass the current prices
     * they already hold so no per-variant read is needed to resolve `price`.
     */
    updateMany(updates: Array<{
        id: string;
        data: UpdateVariantRequest;
        current: {
            sellerPrice: number;
            adminListingPrice: number | null;
        };
    }>): Promise<void>;
    /**
     * Update a variant
     */
    update(id: string, data: UpdateVariantRequest): Promise<ProductVariantEntity>;
    /**
     * Check if SKU exists
     */
    skuExists(productId: string, sku: string, excludeId?: string): Promise<boolean>;
    /**
     * Check if a size/color combination already exists.
     */
    variantCombinationExists(productId: string, size: string, color?: string | null, excludeId?: string): Promise<boolean>;
}
export declare const variantRepository: VariantRepository;
//# sourceMappingURL=variant.repository.d.ts.map