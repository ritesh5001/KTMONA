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
