import type { InventoryMovementEntity, CreateInventoryMovementRequest } from '../types/order.types.js';
/**
 * Inventory Movement Repository
 * Handles auditable inventory change logs
 */
export declare class InventoryMovementRepository {
    /**
     * Create inventory movement record
     */
    createMovement(data: CreateInventoryMovementRequest): Promise<InventoryMovementEntity>;
    /**
     * Create multiple movements in batch
     */
    createMany(movements: CreateInventoryMovementRequest[]): Promise<void>;
    /**
     * Find movements by order ID
     */
    findByOrderId(orderId: string): Promise<InventoryMovementEntity[]>;
    /**
     * Find movements by variant ID
     */
    findByVariantId(variantId: string): Promise<InventoryMovementEntity[]>;
}
export declare const inventoryMovementRepository: InventoryMovementRepository;
//# sourceMappingURL=inventory-movement.repository.d.ts.map