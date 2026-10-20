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
     * Browse the category tree one level at a time instead of loading all of
     * it: `parentId` (an id, or `root`) returns that category's direct
     * children, `q` searches by name (each result carries its `path`), and
     * `ids` looks categories up by id (each carries its `path`). Seller tree
     * by default; the admin panel also sees hidden ones.
     */
    async browse(
        query: { parentId?: string | undefined; q?: string | undefined; ids?: string | undefined },
        opts: { includeInactive?: boolean; scope?: 'SELLER' | 'STOREFRONT' | undefined } = {},
    ): Promise<{ categories: Array<CategoryListResponse['categories'][number] & { childCount: number; path?: string[]; pathIds?: string[] }> }> {
        const includeInactive = Boolean(opts.includeInactive);
        const scope = opts.scope;
        let rows: CategoryListResponse['categories'];
        let withPath = false;

        if (query.q?.trim()) {
            rows = await this.repository.searchByName(query.q.trim().slice(0, 80), { ...(scope ? { scope } : {}), includeInactive, limit: 40 });
            withPath = true;
        } else if (query.ids) {
            const ids = [...new Set(query.ids.split(',').map((v) => v.trim()).filter(Boolean))].slice(0, 200);
            rows = (await this.repository.findByIds(ids)).filter((c) => includeInactive || c.isActive);
            withPath = true;
        } else {
            const parentId = !query.parentId || query.parentId === 'root' ? null : query.parentId;
            rows = await this.repository.findChildren(parentId, { ...(scope ? { scope } : {}), includeInactive });
        }

        const counts = await this.repository.countChildren(rows.map((c) => c.id), includeInactive);
        const paths = withPath ? await this.pathsFor(rows) : null;
        return {
            categories: rows.map((c) => ({
                ...c,
                childCount: counts.get(c.id) ?? 0,
                ...(paths ? { path: paths.get(c.id)?.names ?? [c.name], pathIds: paths.get(c.id)?.ids ?? [c.id] } : {}),
            })),
        };
    }

    /** "Main > Sub > … > Name" for each category, found by walking up (at most 8 levels). */
    private async pathsFor(rows: Array<{ id: string; name: string; parentId: string | null }>): Promise<Map<string, { names: string[]; ids: string[] }>> {
        const known = new Map<string, { id: string; name: string; parentId: string | null }>(rows.map((r) => [r.id, r]));
        let missing = [...new Set(rows.map((r) => r.parentId).filter((id): id is string => Boolean(id) && !known.has(id as string)))];
        for (let depth = 0; depth < 8 && missing.length > 0; depth++) {
            const found = await this.repository.findByIds(missing);
            for (const c of found) known.set(c.id, c);
            missing = [...new Set(found.map((c) => c.parentId).filter((id): id is string => Boolean(id) && !known.has(id as string)))];
        }
        const out = new Map<string, { names: string[]; ids: string[] }>();
        for (const r of rows) {
            const names: string[] = [];
            const ids: string[] = [];
            let cur: { id: string; name: string; parentId: string | null } | undefined = r;
            for (let i = 0; cur && i < 10; i++) {
                names.unshift(cur.name);
                ids.unshift(cur.id);
                cur = cur.parentId ? known.get(cur.parentId) : undefined;
            }
            out.set(r.id, { names, ids });
        }
        return out;
    }

    /** Above this many categories the "everything" lists stop at the top two levels. */
    private static readonly FULL_LIST_LIMIT = 3000;

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

        // The seller listing tree (seller and admin pickers). The customer
        // menu is served by listVisibleCategories(). A tree too big to send in
        // one go is cut to its top two levels; clients browse the rest with
        // browse().
        const tooBig = (await this.repository.countAll({ scope: 'SELLER' })) > CategoryService.FULL_LIST_LIMIT;
        const categories = tooBig
            ? await this.repository.findTopLevels({ scope: 'SELLER' })
            : await this.repository.findAllActive('SELLER');
        const response: CategoryListResponse = { categories, ...(tooBig ? { truncated: true } : {}) };

        // Cache the result
        // Categories change rarely and are invalidated explicitly on mutation.
        await setCache(CACHE_KEYS.CATEGORIES_LIST, response, 1800);

        return response;
    }

    /**
     * Storefront menu: customer (STOREFRONT) categories that have live
     * products through the seller categories linked to them, newest stock
     * first. Until a customer menu exists, the seller tree is used instead.
     * Each category carries `productCount` and `previewImage` (newest product
     * photo, used when it has no image of its own).
     */
    async listVisibleCategories(): Promise<CategoryListResponse> {
        const cached = await getFromCache<CategoryListResponse>(CACHE_KEYS.CATEGORIES_VISIBLE);
        if (cached) return cached;

        const all = await this.repository.findAllActive();
        // Same rule as the storefront product list (productRepository.findPublished).
        const rows = await prisma.$queryRaw<{ categoryId: string; count: bigint; latest: Date; image: string | null }[]>`
            SELECT p."category_id" AS "categoryId", COUNT(*) AS "count", MAX(p."created_at") AS "latest",
                   -- First photo of the newest product: art for categories with no image.
                   (ARRAY_AGG(p."images"[1] ORDER BY p."created_at" DESC) FILTER (WHERE p."images"[1] IS NOT NULL))[1] AS "image"
            FROM "products" p
            WHERE p."status" = 'APPROVED'
              AND p."deleted_by_admin" = false
              AND EXISTS (
                  SELECT 1 FROM "product_variants" pv
                  WHERE pv."product_id" = p."id" AND pv."status" = 'APPROVED'
              )
            GROUP BY p."category_id"`;

        type Stat = { count: number; latest: number; image: string | null; imageAt: number };
        const byId = new Map(all.map((c) => [c.id, c]));
        const add = (stats: Map<string, Stat>, id: string, count: number, latest: number, image: string | null) => {
            const cur = stats.get(id) ?? { count: 0, latest: 0, image: null, imageAt: -1 };
            cur.count += count;
            cur.latest = Math.max(cur.latest, latest);
            if (image && cur.imageAt < latest) {
                cur.image = image;
                cur.imageAt = latest;
            }
            stats.set(id, cur);
        };
        // Credit a category and every ancestor (a parent shows if any child has stock).
        const rollUp = (stats: Map<string, Stat>, from: string, count: number, latest: number, image: string | null) => {
            let id: string | null = from;
            for (let guard = 0; id && guard < 10; guard++) {
                add(stats, id, count, latest, image);
                id = byId.get(id)?.parentId ?? null;
            }
        };

        const sellerStats = new Map<string, Stat>();
        for (const row of rows) rollUp(sellerStats, row.categoryId, Number(row.count), new Date(row.latest).getTime(), row.image);

        const storefront = all.filter((c) => c.scope === 'STOREFRONT');
        let pool = all.filter((c) => c.scope !== 'STOREFRONT');
        let stats = sellerStats;

        if (storefront.length) {
            pool = storefront;
            stats = new Map<string, Stat>();
            const links = await prisma.categoryLink.findMany({ select: { storefrontId: true, sellerCategoryId: true } });
            const linked = new Map<string, Set<string>>();
            for (const l of links) {
                if (!linked.has(l.storefrontId)) linked.set(l.storefrontId, new Set());
                linked.get(l.storefrontId)!.add(l.sellerCategoryId);
            }
            const isUnder = (id: string, set: Set<string>) => {
                let parent = byId.get(id)?.parentId ?? null;
                for (let guard = 0; parent && guard < 10; guard++) {
                    if (set.has(parent)) return true;
                    parent = byId.get(parent)?.parentId ?? null;
                }
                return false;
            };
            for (const [storefrontId, sellerIds] of linked) {
                if (!byId.has(storefrontId)) continue;
                for (const sellerId of sellerIds) {
                    // Linking a category and one of its sub-categories must not count twice.
                    if (isUnder(sellerId, sellerIds)) continue;
                    const st = sellerStats.get(sellerId);
                    if (st?.count) rollUp(stats, storefrontId, st.count, st.latest, st.image);
                }
            }
        }

        // Visible = has products and every ancestor is active (in the list) too.
        const visible = pool.filter((c) => {
            if (!stats.get(c.id)?.count) return false;
            let parent = c.parentId;
            for (let guard = 0; parent && guard < 10; guard++) {
                const p = byId.get(parent);
                if (!p) return false;
                parent = p.parentId;
            }
            return true;
        });

        // Newest stock first; the admin's order breaks ties.
        visible.sort((a, b) => (stats.get(b.id)!.latest - stats.get(a.id)!.latest) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        const response: CategoryListResponse = {
            categories: visible.map((c, index) => ({
                ...c,
                sortOrder: index,
                productCount: stats.get(c.id)!.count,
                previewImage: stats.get(c.id)!.image,
            })),
        };
        await setCache(CACHE_KEYS.CATEGORIES_VISIBLE, response, 120);
        return response;
    }

    /**
     * List all categories for admin (active + inactive)
     */
    async listAllCategories(): Promise<CategoryListResponse> {
        const tooBig = (await this.repository.countAll({ includeInactive: true })) > CategoryService.FULL_LIST_LIMIT;
        if (tooBig) return { categories: await this.repository.findTopLevels({ includeInactive: true }), truncated: true };
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
        scope?: 'SELLER' | 'STOREFRONT' | undefined;
    }) {
        const baseSlug = this.slugify(input.name);
        if (!baseSlug) {
            throw ApiError.badRequest('Invalid category name');
        }

        // Validate parentId if provided
        let scope = input.scope ?? 'SELLER';
        if (input.parentId) {
            const parent = await this.repository.findById(input.parentId);
            if (!parent) {
                throw ApiError.badRequest('Parent category not found');
            }
            // A sub-category always belongs to its parent's tree.
            scope = parent.scope ?? 'SELLER';
        }

        const slug = await this.getUniqueSlug(baseSlug);
        const created = await this.repository.create({ ...input, slug, scope });

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
            if ((parent.scope ?? 'SELLER') !== (category.scope ?? 'SELLER')) {
                throw ApiError.badRequest('A category cannot move between the seller tree and the customer menu');
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
