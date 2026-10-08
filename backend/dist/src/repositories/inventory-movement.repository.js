import { prisma } from '../config/db.js';
/**
 * Inventory Movement Repository
 * Handles auditable inventory change logs
 */
export class InventoryMovementRepository {
    /**
     * Create inventory movement record
     */
    async createMovement(data) {
        return prisma.inventoryMovement.create({
            data: {
                variantId: data.variantId,
                orderId: data.orderId,
                quantity: data.quantity,
                type: data.type,
                ...(data.reason ? { reason: data.reason } : {}),
            },
        });
    }
    /**
     * Create multiple movements in batch
     */
    async createMany(movements) {
        await prisma.inventoryMovement.createMany({
            data: movements.map((m) => ({
                variantId: m.variantId,
                orderId: m.orderId,
                quantity: m.quantity,
                type: m.type,
                ...(m.reason ? { reason: m.reason } : {}),
            })),
        });
    }
    /**
     * Find movements by order ID
     */
    async findByOrderId(orderId) {
        return prisma.inventoryMovement.findMany({
            where: { orderId },
            orderBy: { createdAt: 'asc' },
        });
    }
    /**
     * Find movements by variant ID
     */
    async findByVariantId(variantId) {
        return prisma.inventoryMovement.findMany({
            where: { variantId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
// Export singleton instance
export const inventoryMovementRepository = new InventoryMovementRepository();
//# sourceMappingURL=inventory-movement.repository.js.map