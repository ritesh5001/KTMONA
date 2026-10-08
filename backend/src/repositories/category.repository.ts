import { prisma } from '../config/db.js';
import type { CategoryEntity } from '../types/product.types.js';

/**
 * Category Repository
 * Handles database operations for categories
 */
export class CategoryRepository {
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
    async findAllActive(): Promise<CategoryEntity[]> {
        return prisma.category.findMany({
            where: { isActive: true },
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
        const category = await prisma.category.findFirst({
            where: { id, isActive: true },
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
