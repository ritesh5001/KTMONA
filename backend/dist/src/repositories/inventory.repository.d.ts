import type { InventoryEntity } from '../types/product.types.js';
/**
 * Inventory Repository
 * Handles database operations for inventory
 */
export declare class InventoryRepository {
    /**
     * Update stock for a variant
     */
    updateStock(variantId: string, stock: number): Promise<InventoryEntity>;
    /**
     * Set stock for several variants in one round trip.
     */
    setStockMany(entries: Array<{
        variantId: string;
        stock: number;
    }>): Promise<void>;
    /**
     * Find inventory by variant ID
     */
    findByVariantId(variantId: string): Promise<InventoryEntity | null>;
    /**
     * Get current stock
     */
    getStock(variantId: string): Promise<number>;
}
export declare const inventoryRepository: InventoryRepository;
//# sourceMappingURL=inventory.repository.d.ts.map