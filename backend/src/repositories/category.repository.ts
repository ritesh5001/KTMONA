import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import type { CategoryEntity } from '../types/product.types.js';

/**
 * Category Repository
 * Handles database operations for categories
 */
export class CategoryRepository {
    /**
     * Direct children of one category (`null` = top level), in menu order.
     * `includeInactive` is for the admin panel.
     */
    async findChildren(
        parentId: string | null,
        opts: { scope?: 'SELLER' | 'STOREFRONT'; includeInactive?: boolean } = {},
    ): Promise<CategoryEntity[]> {
        return prisma.category.findMany({
            where: {
                parentId,
                ...(opts.includeInactive ? {} : { isActive: true }),
                ...(opts.scope ? { scope: opts.scope } : {}),
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }) as unknown as CategoryEntity[];
    }

    /**
     * The chain from the main category down to each given category, in one
     * query: `names` and `ids` start at the top and end at the category.
     */
    async pathsFor(ids: string[]): Promise<Map<string, { names: string[]; ids: string[] }>> {
        const unique = [...new Set(ids)].filter(Boolean);
        if (unique.length === 0) return new Map();
        const rows = await prisma.$queryRaw<{ start: string; id: string; name: string; depth: number }[]>`
            WITH RECURSIVE up AS (
                SELECT c."id" AS "start", c."id", c."name", c."parent_id", 0 AS "depth"
                FROM "categories" c WHERE c."id" IN (${Prisma.join(unique)})
                UNION ALL
                SELECT up."start", p."id", p."name", p."parent_id", up."depth" + 1
                FROM "categories" p JOIN up ON p."id" = up."parent_id"
                WHERE up."depth" < 12
            )
            SELECT "start", "id", "name", "depth" FROM up`;
        const grouped = new Map<string, { id: string; name: string; depth: number }[]>();
        for (const r of rows) {
            if (!grouped.has(r.start)) grouped.set(r.start, []);
            grouped.get(r.start)!.push({ id: r.id, name: r.name, depth: Number(r.depth) });
        }
        const out = new Map<string, { names: string[]; ids: string[] }>();
        for (const [start, chain] of grouped) {
            chain.sort((a, b) => b.depth - a.depth);
            out.set(start, { names: chain.map((c) => c.name), ids: chain.map((c) => c.id) });
        }
        return out;
    }

    /**
     * Active categories among `ids` plus their active ancestors (stopping at
     * a hidden one), in one query. Used to build the storefront menu from the
     * categories that actually hold products, without loading the whole tree.
     */
    async findActiveWithAncestors(ids: string[]): Promise<CategoryEntity[]> {
        const unique = [...new Set(ids)].filter(Boolean);
        if (unique.length === 0) return [];
        const rows = await prisma.$queryRaw<{ id: string }[]>`
            WITH RECURSIVE up AS (
                SELECT c."id", c."parent_id", 0 AS "depth" FROM "categories" c
                WHERE c."id" IN (${Prisma.join(unique)}) AND c."is_active" = true
                UNION
                SELECT p."id", p."parent_id", up."depth" + 1 FROM "categories" p
                JOIN up ON p."id" = up."parent_id"
                WHERE p."is_active" = true AND up."depth" < 12
            )
            SELECT DISTINCT "id" FROM up`;
        if (rows.length === 0) return [];
        return prisma.category.findMany({ where: { id: { in: rows.map((r) => r.id) } } }) as unknown as CategoryEntity[];
    }

    /** How many children each of these categories has. */
    async countChildren(ids: string[], includeInactive: boolean): Promise<Map<string, number>> {
        if (ids.length === 0) return new Map();
        const rows = await prisma.category.groupBy({
            by: ['parentId'],
            where: { parentId: { in: ids }, ...(includeInactive ? {} : { isActive: true }) },
            _count: { _all: true },
        });
        return new Map(rows.map((r) => [r.parentId as string, r._count._all]));
    }

    /** Name search, best matches first (shorter names first). */
    async searchByName(
        q: string,
        opts: { scope?: 'SELLER' | 'STOREFRONT'; includeInactive?: boolean; limit: number },
    ): Promise<CategoryEntity[]> {
        const rows = (await prisma.category.findMany({
            where: {
                name: { contains: q, mode: 'insensitive' },
                ...(opts.includeInactive ? {} : { isActive: true }),
                ...(opts.scope ? { scope: opts.scope } : {}),
            },
            take: opts.limit * 3,
        })) as unknown as CategoryEntity[];
        const lower = q.toLowerCase();
        return rows
            .sort((a, b) => Number(b.name.toLowerCase().startsWith(lower)) - Number(a.name.toLowerCase().startsWith(lower)) || a.name.length - b.name.length)
            .slice(0, opts.limit);
    }

    async findByIds(ids: string[]): Promise<CategoryEntity[]> {
        if (ids.length === 0) return [];
        return prisma.category.findMany({ where: { id: { in: ids } } }) as unknown as CategoryEntity[];
    }

    async countAll(opts: { scope?: 'SELLER' | 'STOREFRONT'; includeInactive?: boolean } = {}): Promise<number> {
        return prisma.category.count({
            where: { ...(opts.includeInactive ? {} : { isActive: true }), ...(opts.scope ? { scope: opts.scope } : {}) },
        });
    }

    /** Top two levels only (main categories and their direct sub-categories). */
    async findTopLevels(opts: { scope?: 'SELLER' | 'STOREFRONT'; includeInactive?: boolean } = {}): Promise<CategoryEntity[]> {
        return prisma.category.findMany({
            where: {
                OR: [{ parentId: null }, { parent: { parentId: null } }],
                ...(opts.includeInactive ? {} : { isActive: true }),
                ...(opts.scope ? { scope: opts.scope } : {}),
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }) as unknown as CategoryEntity[];
    }

    /**
     * Find all categories (active + inactive)
     */
    async findAll(): Promise<CategoryEntity[]> {
        return prisma.category.findMany({
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }) as unknown as CategoryEntity[];
    }

    /**
     * Find all active categories
     */
    async findAllActive(scope?: 'SELLER' | 'STOREFRONT'): Promise<CategoryEntity[]> {
        return prisma.category.findMany({
            where: { isActive: true, ...(scope ? { scope } : {}) },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }) as unknown as CategoryEntity[];
    }

    /**
     * Find category by slug
     */
    async findBySlug(slug: string): Promise<CategoryEntity | null> {
        return prisma.category.findUnique({
            where: { slug },
        });
    }

    /**
     * Find category by ID
     */
    async findById(id: string): Promise<CategoryEntity | null> {
        return prisma.category.findUnique({
            where: { id },
        });
    }

    /**
     * Check if category exists and is active
     */
    async existsAndActive(id: string): Promise<boolean> {
        // Products live in seller categories only; the customer menu links to them.
        const category = await prisma.category.findFirst({
            where: { id, isActive: true, scope: 'SELLER' },
            select: { id: true },
        });
        return category !== null;
    }

    /**
     * Create category
     */
    async create(data: {
        name: string;
        slug: string;
        description?: string | undefined;
        image?: string | undefined;
        bannerImage?: string | undefined;
        parentId?: string | undefined;
        sortOrder?: number | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        scope?: 'SELLER' | 'STOREFRONT' | undefined;
    }): Promise<CategoryEntity> {
        return prisma.category.create({
            data: {
                name: data.name,
                slug: data.slug,
                isActive: true,
                ...(data.description !== undefined && { description: data.description }),
                ...(data.image !== undefined && { image: data.image }),
                ...(data.bannerImage !== undefined && { bannerImage: data.bannerImage }),
                ...(data.parentId !== undefined && { parentId: data.parentId }),
                ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
                ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
                ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
                ...(data.scope !== undefined && { scope: data.scope }),
            },
        }) as unknown as CategoryEntity;
    }

    /**
     * Update category
     */
    async update(
        id: string,
        data: {
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
        }
    ): Promise<CategoryEntity> {
        return prisma.category.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.slug !== undefined && { slug: data.slug }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.image !== undefined && { image: data.image }),
                ...(data.bannerImage !== undefined && { bannerImage: data.bannerImage }),
                ...(data.parentId !== undefined && { parentId: data.parentId }),
                ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
                ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
            },
        }) as unknown as CategoryEntity;
    }

    /**
     * Check if category has products assigned
     */
    async hasProducts(id: string): Promise<boolean> {
        const count = await prisma.product.count({
            where: {
                categoryId: id,
                deletedByAdmin: false,
            },
        });
        return count > 0;
    }

    /**
     * Remove soft-deleted products that still reference the category
     */
    async purgeSoftDeletedProducts(categoryId: string): Promise<void> {
        await prisma.product.deleteMany({
            where: {
                categoryId,
                deletedByAdmin: true,
            },
        });
    }

    /**
     * Hard delete a category
     */
    async delete(id: string): Promise<void> {
        await prisma.category.delete({ where: { id } });
    }
}

// Export singleton instance
export const categoryRepository = new CategoryRepository();
