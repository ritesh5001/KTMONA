export interface OccasionEntity {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Occasion Repository
 * Handles database operations for occasions
 */
export declare class OccasionRepository {
    findAll(): Promise<OccasionEntity[]>;
    findAllActive(): Promise<OccasionEntity[]>;
    findById(id: string): Promise<OccasionEntity | null>;
    findBySlug(slug: string): Promise<OccasionEntity | null>;
    create(data: {
        name: string;
        slug: string;
        image?: string | undefined;
    }): Promise<OccasionEntity>;
    update(id: string, data: {
        name?: string | undefined;
        slug?: string | undefined;
        image?: string | null | undefined;
        isActive?: boolean | undefined;
    }): Promise<OccasionEntity>;
    delete(id: string): Promise<void>;
    hasProducts(id: string): Promise<boolean>;
    findActiveByIds(ids: string[]): Promise<OccasionEntity[]>;
    /**
     * Sync occasions for a product (replace all).
     */
    syncProductOccasions(productId: string, occasionIds: string[]): Promise<void>;
    /**
     * Get occasion IDs for a product.
     */
    getProductOccasionIds(productId: string): Promise<string[]>;
}
export declare const occasionRepository: OccasionRepository;
//# sourceMappingURL=occasion.repository.d.ts.map