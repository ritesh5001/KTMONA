import { OccasionRepository, type OccasionEntity } from '../repositories/occasion.repository.js';
/**
 * Occasion Service
 * Business logic for occasion management
 */
export declare class OccasionService {
    private readonly repository;
    constructor(repository: OccasionRepository);
    private slugify;
    private getUniqueSlug;
    /**
     * List all active occasions (public)
     */
    listOccasions(): Promise<{
        occasions: OccasionEntity[];
    }>;
    /**
     * List all occasions for admin (active + inactive)
     */
    listAllOccasions(): Promise<{
        occasions: OccasionEntity[];
    }>;
    /**
     * Create occasion (admin)
     */
    createOccasion(input: {
        name: string;
        image?: string | undefined;
    }): Promise<OccasionEntity>;
    /**
     * Update occasion (admin)
     */
    updateOccasion(id: string, data: {
        name?: string | undefined;
        image?: string | null | undefined;
        isActive?: boolean | undefined;
    }): Promise<OccasionEntity>;
    /**
     * Delete occasion (admin) — fails if products are linked
     */
    deleteOccasion(id: string): Promise<void>;
    /**
     * Toggle occasion active state (admin)
     */
    toggleOccasion(id: string): Promise<OccasionEntity>;
    /**
     * Validate that all occasion IDs exist and are active.
     * Uses batch query instead of N+1 individual lookups.
     */
    validateOccasionIds(ids: string[]): Promise<void>;
    /**
     * Sync occasions for a product.
     */
    syncProductOccasions(productId: string, occasionIds: string[]): Promise<void>;
    /**
     * Get occasion IDs for a product.
     */
    getProductOccasionIds(productId: string): Promise<string[]>;
}
export declare const occasionService: OccasionService;
//# sourceMappingURL=occasion.service.d.ts.map