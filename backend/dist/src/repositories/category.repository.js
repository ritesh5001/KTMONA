import { prisma } from '../config/db.js';
/**
 * Category Repository
 * Handles database operations for categories
 */
export class CategoryRepository {
    /**
     * Find all categories (active + inactive)
     */
    async findAll() {
        return prisma.category.findMany({
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
    }
    /**
     * Find all active categories
     */
    async findAllActive() {
        return prisma.category.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
    }
    /**
     * Find category by slug
     */
    async findBySlug(slug) {
        return prisma.category.findUnique({
            where: { slug },
        });
    }
    /**
     * Find category by ID
     */
    async findById(id) {
        return prisma.category.findUnique({
            where: { id },
        });
    }
    /**
     * Check if category exists and is active
     */
    async existsAndActive(id) {
        const category = await prisma.category.findFirst({
            where: { id, isActive: true },
            select: { id: true },
        });
        return category !== null;
    }
    /**
     * Create category
     */
    async create(data) {
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
        });
    }
    /**
     * Update category
     */
    async update(id, data) {
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
        });
    }
    /**
     * Check if category has products assigned
     */
    async hasProducts(id) {
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
    async purgeSoftDeletedProducts(categoryId) {
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
    async delete(id) {
        await prisma.category.delete({ where: { id } });
    }
}
// Export singleton instance
export const categoryRepository = new CategoryRepository();
//# sourceMappingURL=category.repository.js.map