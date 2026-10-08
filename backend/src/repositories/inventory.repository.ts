import { prisma } from '../config/db.js';
import type { InventoryEntity } from '../types/product.types.js';

/**
 * Inventory Repository
 * Handles database operations for inventory
 */
export class InventoryRepository {
    /**
     * Update stock for a variant
     */
    async updateStock(variantId: string, stock: number): Promise<InventoryEntity> {
        return prisma.inventory.upsert({
            where: { variantId },
            update: { stock },
            create: {
                variantId,
                stock,
            },
        });
    }

    /**
     * Set stock for several variants in one round trip.
     */
    async setStockMany(entries: Array<{ variantId: string; stock: number }>): Promise<void> {
        if (entries.length === 0) return;

        await prisma.$transaction(
            entries.map(({ variantId, stock }) =>
                prisma.inventory.upsert({
                    where: { variantId },
                    update: { stock },
                    create: { variantId, stock },
                }),
            ),
        );
    }

    /**
     * Find inventory by variant ID
     */
    async findByVariantId(variantId: string): Promise<InventoryEntity | null> {
        return prisma.inventory.findUnique({
            where: { variantId },
        });
    }

    /**
     * Get current stock
     */
    async getStock(variantId: string): Promise<number> {
        const inventory = await prisma.inventory.findUnique({
            where: { variantId },
            select: { stock: true },
        });
        return inventory?.stock ?? 0;
    }
}

// Export singleton instance
export const inventoryRepository = new InventoryRepository();
