import { CategoryRepository, categoryRepository } from '../repositories/category.repository.js';
import {
    getFromCache,
    setCache,
    CACHE_KEYS,
    invalidateCategoryCache,
} from '../utils/cache.util.js';
import type { CategoryListResponse } from '../types/product.types.js';
import { ApiError } from '../errors/ApiError.js';
import { prisma } from '../config/db.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, collectionTag } from '../live/cache-tags.js';

/**
 * Category Service
 * Business logic for category operations
 */
export class CategoryService {
    constructor(private readonly repository: CategoryRepository) { }

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    private async getUniqueSlug(base: string, excludeId?: string) {
        let slug = base;
        let counter = 1;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const existing = await this.repository.findBySlug(slug);
            if (!existing || (excludeId && existing.id === excludeId)) {
                return slug;
            }
            counter += 1;
            slug = `${base}-${counter}`;
        }
    }

    /**
     * List all active categories
     * Uses Redis caching
     */
    async listCategories(): Promise<CategoryListResponse> {
        // Try cache first
        const cached = await getFromCache<CategoryListResponse>(CACHE_KEYS.CATEGORIES_LIST);
        if (cached) {
            return cached;
        }

        // Fetch from database
        const categories = await this.repository.findAllActive();
        const response: CategoryListResponse = { categories };

        // Cache the result
        // Categories change rarely and are invalidated explicitly on mutation.
        await setCache(CACHE_KEYS.CATEGORIES_LIST, response, 1800);

        return response;
    }

    /**
     * Storefront categories (GET /v1/categories?visible=1).
     *
     * Hides every category with no live product in it or below it, and puts the
     * categories whose newest product is most recent first (siblings re-ranked
     * through `sortOrder`, which the website and app already sort by). Seller and
     * admin pickers keep using the full list, so empty categories stay listable.
     * Cached briefly so a newly approved product shows up within a couple of minutes.
     */
    async listVisibleCategories(): Promise<CategoryListResponse> {
        const cached = await getFromCache<CategoryListResponse>(CACHE_KEYS.CATEGORIES_VISIBLE);
        if (cached) return cached;

        const { categories } = await this.listCategories();
        // Same rule as the storefront product list (productRepository.findPublished).
        const rows = await prisma.$queryRaw<{ categoryId: string; count: bigint; latest: Date }[]>`
            SELECT p."category_id" AS "categoryId", COUNT(*) AS "count", MAX(p."created_at") AS "latest"
            FROM "products" p
            WHERE p."status" = 'APPROVED'
              AND p."deleted_by_admin" = false
              AND EXISTS (
                  SELECT 1 FROM "product_variants" pv
                  WHERE pv."product_id" = p."id" AND pv."status" = 'APPROVED'
              )
            GROUP BY p."category_id"`;

        const byId = new Map(categories.map((c) => [c.id, c]));
        const count = new Map<string, number>();
        const latest = new Map<string, number>();
        for (const row of rows) {
            // Credit the category and every ancestor (a parent shows if any child has stock).
            let id: string | null = row.categoryId;
            for (let guard = 0; id && guard < 10; guard++) {
                count.set(id, (count.get(id) ?? 0) + Number(row.count));
                latest.set(id, Math.max(latest.get(id) ?? 0, new Date(row.latest).getTime()));
                id = byId.get(id)?.parentId ?? null;
            }
        }

        // Visible = has products and every ancestor is active (in the list) too.
        const visible = categories.filter((c) => {
            if (!count.get(c.id)) return false;
            let parent = c.parentId;
            for (let guard = 0; parent && guard < 10; guard++) {
                const p = byId.get(parent);
                if (!p) return false;
                parent = p.parentId;
            }
            return true;
        });

        // Newest stock first; the admin's order breaks ties.
        visible.sort((a, b) => (latest.get(b.id)! - latest.get(a.id)!) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        const response: CategoryListResponse = {
            categories: visible.map((c, index) => ({ ...c, sortOrder: index, productCount: count.get(c.id)! })),
        };
        await setCache(CACHE_KEYS.CATEGORIES_VISIBLE, response, 120);
        return response;
    }

    /**
     * List all categories for admin (active + inactive)
     */
    async listAllCategories(): Promise<CategoryListResponse> {
        const categories = await this.repository.findAll();
        return { categories };
    }

    /**
     * Create category (admin)
     */
    async createCategory(input: {
        name: string;
        description?: string | undefined;
        image?: string | undefined;
        bannerImage?: string | undefined;
        parentId?: string | undefined;
        sortOrder?: number | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
    }) {
        const baseSlug = this.slugify(input.name);
        if (!baseSlug) {
            throw ApiError.badRequest('Invalid category name');
        }

        // Validate parentId if provided
        if (input.parentId) {
            const parent = await this.repository.findById(input.parentId);
            if (!parent) {
                throw ApiError.badRequest('Parent category not found');
            }
        }

        const slug = await this.getUniqueSlug(baseSlug);
        const created = await this.repository.create({ ...input, slug });

        await invalidateCategoryCache();
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [CACHE_TAGS.categories, CACHE_TAGS.products, CACHE_TAGS.search, collectionTag(slug)],
            audience: { allAuthenticated: true },
        });
        return created;
    }

    /**
     * Update category (admin)
     */
    async updateCategory(id: string, data: {
        name?: string | undefined;
        description?: string | null | undefined;
        isActive?: boolean | undefined;
        image?: string | null | undefined;
        bannerImage?: string | null | undefined;
        parentId?: string | null | undefined;
        sortOrder?: number | undefined;
        seoTitle?: string | null | undefined;
        seoDescription?: string | null | undefined;
    }) {
        const category = await this.repository.findById(id);
        if (!category) {
            throw ApiError.notFound('Category not found');
        }

        // Validate parentId if provided and not null
        if (data.parentId) {
            if (data.parentId === id) {
                throw ApiError.badRequest('Category cannot be its own parent');
            }
            const parent = await this.repository.findById(data.parentId);
            if (!parent) {
                throw ApiError.badRequest('Parent category not found');
            }
        }

        let slug: string | undefined;
        if (data.name) {
            const baseSlug = this.slugify(data.name);
            if (!baseSlug) {
                throw ApiError.badRequest('Invalid category name');
            }
            slug = await this.getUniqueSlug(baseSlug, id);
        }

        const updated = await this.repository.update(id, {
            ...data,
            ...(slug ? { slug } : {}),
        });

        await invalidateCategoryCache();
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [
                CACHE_TAGS.categories,
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                collectionTag(updated.slug),
                ...(category.slug ? [collectionTag(category.slug)] : []),
            ],
            audience: { allAuthenticated: true },
        });
        return updated;
    }

    /**
     * Delete category (admin) — fails if products exist
     */
    async deleteCategory(id: string) {
        const category = await this.repository.findById(id);
        if (!category) {
            throw ApiError.notFound('Category not found');
        }

        const hasProducts = await this.repository.hasProducts(id);
        if (hasProducts) {
            throw ApiError.badRequest('Cannot delete category that has products. Reassign products first.');
        }

        await this.repository.purgeSoftDeletedProducts(id);
        await this.repository.delete(id);
        await invalidateCategoryCache();
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [
                CACHE_TAGS.categories,
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                ...(category.slug ? [collectionTag(category.slug)] : []),
            ],
            audience: { allAuthenticated: true },
        });
    }

    /**
     * Toggle category active state
     */
    async toggleCategory(id: string) {
        const category = await this.repository.findById(id);
        if (!category) {
            throw ApiError.notFound('Category not found');
        }

        const updated = await this.repository.update(id, { isActive: !category.isActive });
        await invalidateCategoryCache();
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [
                CACHE_TAGS.categories,
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                collectionTag(updated.slug),
            ],
            audience: { allAuthenticated: true },
        });
        return updated;
    }

    /**
     * Deactivate category (admin)
     */
    async deactivateCategory(id: string) {
        const category = await this.repository.findById(id);
        if (!category) {
            throw ApiError.notFound('Category not found');
        }

        const updated = await this.repository.update(id, { isActive: false });
        await invalidateCategoryCache();
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [
                CACHE_TAGS.categories,
                CACHE_TAGS.products,
                CACHE_TAGS.search,
                collectionTag(updated.slug),
            ],
            audience: { allAuthenticated: true },
        });
        return updated;
    }
}

// Export singleton instance with default repository
export const categoryService = new CategoryService(categoryRepository);
