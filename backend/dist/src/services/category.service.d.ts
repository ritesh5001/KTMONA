import { CategoryRepository } from '../repositories/category.repository.js';
import type { CategoryListResponse } from '../types/product.types.js';
/**
 * Category Service
 * Business logic for category operations
 */
export declare class CategoryService {
    private readonly repository;
    constructor(repository: CategoryRepository);
    private slugify;
    private getUniqueSlug;
    /**
     * List all active categories
     * Uses Redis caching
     */
    listCategories(): Promise<CategoryListResponse>;
    /**
     * List all categories for admin (active + inactive)
     */
    listAllCategories(): Promise<CategoryListResponse>;
    /**
     * Create category (admin)
     */
    createCategory(input: {
        name: string;
        description?: string | undefined;
        image?: string | undefined;
        bannerImage?: string | undefined;
        parentId?: string | undefined;
        sortOrder?: number | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
    }): Promise<import("../types/product.types.js").CategoryEntity>;
    /**
     * Update category (admin)
     */
    updateCategory(id: string, data: {
        name?: string | undefined;
        description?: string | null | undefined;
        isActive?: boolean | undefined;
        image?: string | null | undefined;
        bannerImage?: string | null | undefined;
        parentId?: string | null | undefined;
        sortOrder?: number | undefined;
        seoTitle?: string | null | undefined;
        seoDescription?: string | null | undefined;
    }): Promise<import("../types/product.types.js").CategoryEntity>;
    /**
     * Delete category (admin) — fails if products exist
     */
    deleteCategory(id: string): Promise<void>;
    /**
     * Toggle category active state
     */
    toggleCategory(id: string): Promise<import("../types/product.types.js").CategoryEntity>;
    /**
     * Deactivate category (admin)
     */
    deactivateCategory(id: string): Promise<import("../types/product.types.js").CategoryEntity>;
}
export declare const categoryService: CategoryService;
//# sourceMappingURL=category.service.d.ts.map