import { prisma } from '../config/db.js';
const db = prisma;
/**
 * Occasion Repository
 * Handles database operations for occasions
 */
export class OccasionRepository {
    async findAll() {
        return db.occasion.findMany({
            orderBy: { name: 'asc' },
        });
    }
    async findAllActive() {
        return db.occasion.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }
    async findById(id) {
        return db.occasion.findUnique({ where: { id } });
    }
    async findBySlug(slug) {
        return db.occasion.findUnique({ where: { slug } });
    }
    async create(data) {
        return db.occasion.create({
            data: {
                name: data.name,
                slug: data.slug,
                isActive: true,
                ...(data.image !== undefined && { image: data.image }),
            },
        });
    }
    async update(id, data) {
        return db.occasion.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.slug !== undefined && { slug: data.slug }),
                ...(data.image !== undefined && { image: data.image }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });
    }
    async delete(id) {
        await db.occasion.delete({ where: { id } });
    }
    async hasProducts(id) {
        const count = await db.productOccasion.count({
            where: { occasionId: id },
        });
        return count > 0;
    }
    async findActiveByIds(ids) {
        return db.occasion.findMany({
            where: {
                id: { in: ids },
                isActive: true,
            },
        });
    }
    /**
     * Sync occasions for a product (replace all).
     */
    async syncProductOccasions(productId, occasionIds) {
        await db.$transaction([
            db.productOccasion.deleteMany({ where: { productId } }),
            ...(occasionIds.length > 0
                ? [
                    db.productOccasion.createMany({
                        data: occasionIds.map((occasionId) => ({
                            productId,
                            occasionId,
                        })),
                        skipDuplicates: true,
                    }),
                ]
                : []),
        ]);
    }
    /**
     * Get occasion IDs for a product.
     */
    async getProductOccasionIds(productId) {
        const links = await db.productOccasion.findMany({
            where: { productId },
            select: { occasionId: true },
        });
        return links.map((link) => link.occasionId);
    }
}
export const occasionRepository = new OccasionRepository();
//# sourceMappingURL=occasion.repository.js.map