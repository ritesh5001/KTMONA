import type { CategoryEntity } from '../types/product.types.js';
/**
 * Category Repository
 * Handles database operations for categories
 */
export declare class CategoryRepository {
    /**
     * Find all categories (active + inactive)
     */
    findAll(): Promise<CategoryEntity[]>;
    /**
     * Find all active categories
     */
    findAllActive(): Promise<CategoryEntity[]>;
    /**
     * Find category by slug
     */
    findBySlug(slug: string): Promise<CategoryEntity | null>;
    /**
     * Find category by ID
     */
    findById(id: string): Promise<CategoryEntity | null>;
    /**
     * Check if category exists and is active
     */
    existsAndActive(id: string): Promise<boolean>;
    /**
     * Create category
     */
    create(data: {
        name: string;
        slug: string;
        description?: string | undefined;
        image?: string | undefined;
        bannerImage?: string | undefined;
        parentId?: string | undefined;
        sortOrder?: number | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
    }): Promise<CategoryEntity>;
    /**
     * Update category
     */
    update(id: string, data: {
        name?: string | undefined;
        slug?: string | undefined;
        description?: string | null | undefined;
        image?: string | null | undefined;
        bannerImage?: string | null | undefined;
        parentId?: string | null | undefined;
        sortOrder?: number | undefined;
        isActive?: boolean | undefined;
        seoTitle?: string | null | undefined;
        seoDescription?: string | null | undefined;
    }): Promise<CategoryEntity>;
    /**
     * Check if category has products assigned
     */
    hasProducts(id: string): Promise<boolean>;
    /**
     * Remove soft-deleted products that still reference the category
     */
    purgeSoftDeletedProducts(categoryId: string): Promise<void>;
    /**
     * Hard delete a category
     */
    delete(id: string): Promise<void>;
}
export declare const categoryRepository: CategoryRepository;
//# sourceMappingURL=category.repository.d.ts.map