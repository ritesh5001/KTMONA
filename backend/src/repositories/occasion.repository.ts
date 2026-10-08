import { prisma } from '../config/db.js';
const db = prisma as any;

export interface OccasionEntity {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Occasion Repository
 * Handles database operations for occasions
 */
export class OccasionRepository {
    async findAll(): Promise<OccasionEntity[]> {
        return db.occasion.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async findAllActive(): Promise<OccasionEntity[]> {
        return db.occasion.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }

    async findById(id: string): Promise<OccasionEntity | null> {
        return db.occasion.findUnique({ where: { id } });
    }

    async findBySlug(slug: string): Promise<OccasionEntity | null> {
        return db.occasion.findUnique({ where: { slug } });
    }

    async create(data: {
        name: string;
        slug: string;
        image?: string | undefined;
    }): Promise<OccasionEntity> {
        return db.occasion.create({
            data: {
                name: data.name,
                slug: data.slug,
                isActive: true,
                ...(data.image !== undefined && { image: data.image }),
            },
        });
    }

    async update(
        id: string,
        data: {
            name?: string | undefined;
            slug?: string | undefined;
            image?: string | null | undefined;
            isActive?: boolean | undefined;
        }
    ): Promise<OccasionEntity> {
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

    async delete(id: string): Promise<void> {
        await db.occasion.delete({ where: { id } });
    }

    async hasProducts(id: string): Promise<boolean> {
        const count = await db.productOccasion.count({
            where: { occasionId: id },
        });
        return count > 0;
    }

    async findActiveByIds(ids: string[]): Promise<OccasionEntity[]> {
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
    async syncProductOccasions(productId: string, occasionIds: string[]): Promise<void> {
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
    async getProductOccasionIds(productId: string): Promise<string[]> {
        const links = await db.productOccasion.findMany({
            where: { productId },
            select: { occasionId: true },
        });
        return links.map((link: { occasionId: string }) => link.occasionId);
    }
}

export const occasionRepository = new OccasionRepository();
