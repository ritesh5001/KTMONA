import { categoryRepository } from '../repositories/category.repository.js';
import { getFromCache, setCache, CACHE_KEYS, invalidateCache, } from '../utils/cache.util.js';
import { ApiError } from '../errors/ApiError.js';
import { dispatchFreshness } from '../live/freshness.service.js';
import { CACHE_TAGS, collectionTag } from '../live/cache-tags.js';
/**
 * Category Service
 * Business logic for category operations
 */
export class CategoryService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    slugify(value) {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
    async getUniqueSlug(base, excludeId) {
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
    async listCategories() {
        // Try cache first
        const cached = await getFromCache(CACHE_KEYS.CATEGORIES_LIST);
        if (cached) {
            return cached;
        }
        // Fetch from database
        const categories = await this.repository.findAllActive();
        const response = { categories };
        // Cache the result
        // Categories change rarely and are invalidated explicitly on mutation.
        await setCache(CACHE_KEYS.CATEGORIES_LIST, response, 1800);
        return response;
    }
    /**
     * List all categories for admin (active + inactive)
     */
    async listAllCategories() {
        const categories = await this.repository.findAll();
        return { categories };
    }
    /**
     * Create category (admin)
     */
    async createCategory(input) {
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
        await invalidateCache(CACHE_KEYS.CATEGORIES_LIST);
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
    async updateCategory(id, data) {
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
        let slug;
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
        await invalidateCache(CACHE_KEYS.CATEGORIES_LIST);
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
    async deleteCategory(id) {
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
        await invalidateCache(CACHE_KEYS.CATEGORIES_LIST);
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
    async toggleCategory(id) {
        const category = await this.repository.findById(id);
        if (!category) {
            throw ApiError.notFound('Category not found');
        }
        const updated = await this.repository.update(id, { isActive: !category.isActive });
        await invalidateCache(CACHE_KEYS.CATEGORIES_LIST);
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
    async deactivateCategory(id) {
        const category = await this.repository.findById(id);
        if (!category) {
            throw ApiError.notFound('Category not found');
        }
        const updated = await this.repository.update(id, { isActive: false });
        await invalidateCache(CACHE_KEYS.CATEGORIES_LIST);
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
//# sourceMappingURL=category.service.js.map