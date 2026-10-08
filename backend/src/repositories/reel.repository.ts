import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import type { ReelQueryFilters } from '../types/reel.types.js';

const productSelect = {
    id: true,
    title: true,
    images: true,
    adminListingPrice: true,
    sellerPrice: true,
    status: true,
} as const;

const sellerSelect = {
    id: true,
    email: true,
    seller_profiles: {
        select: { store_name: true },
    },
} as const;

export class ReelRepository {

    private readonly reelViewsBufferKey = 'reel:views:buffer';

    async create(data: {
        sellerId: string;
        videoUrl: string;
        thumbnailUrl?: string | undefined;
        caption?: string | undefined;
        category?: 'MENS' | 'KIDS' | undefined;
        productId?: string | undefined;
    }) {
        return prisma.reel.create({
            data: {
                sellerId: data.sellerId,
                category: data.category ?? 'MENS',
                videoUrl: data.videoUrl,
                thumbnailUrl: data.thumbnailUrl ?? null,
                caption: data.caption ?? null,
                productId: data.productId ?? null,
            },
        });
    }

    async findByIdAndSeller(id: string, sellerId: string) {
        return prisma.reel.findFirst({
            where: { id, sellerId },
            include: { product: { select: productSelect } },
        });
    }

    async findById(id: string) {
        return prisma.reel.findUnique({
            where: { id },
            include: {
                product: { select: productSelect },
                seller: { select: sellerSelect },
            },
        });
    }

    async findBySeller(sellerId: string, filters: ReelQueryFilters) {
        const { page = 1, limit = 20, category } = filters;
        const skip = (page - 1) * limit;

        const where = {
            sellerId,
            ...(category && { category }),
        };

        const [reels, total] = await Promise.all([
            prisma.reel.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { product: { select: productSelect } },
            }),
            prisma.reel.count({ where }),
        ]);

        return { reels, total };
    }

    async findAllAdmin(filters: ReelQueryFilters) {
        const { page = 1, limit = 20, status, category } = filters;
        const skip = (page - 1) * limit;

        const where = {
            ...(status && { status }),
            ...(category && { category }),
        };

        const [reels, total] = await Promise.all([
            prisma.reel.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: productSelect },
                    seller: { select: sellerSelect },
                },
            }),
            prisma.reel.count({ where }),
        ]);

        return { reels, total };
    }

    async findPublished(filters: ReelQueryFilters) {
        const { page = 1, limit = 20, category } = filters;
        const skip = (page - 1) * limit;

        const where = {
            status: 'APPROVED' as const,
            ...(category && { category }),
        };

        const [reels, total] = await Promise.all([
            prisma.reel.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: productSelect },
                    seller: { select: sellerSelect },
                },
            }),
            prisma.reel.count({ where }),
        ]);

        return { reels, total };
    }

    async findPublishedById(id: string) {
        return prisma.reel.findFirst({
            where: { id, status: 'APPROVED' },
            include: {
                product: { select: productSelect },
                seller: { select: sellerSelect },
            },
        });
    }

    async updateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
        return prisma.reel.update({
            where: { id },
            data: { status },
        });
    }

    async updateSellerFields(
        id: string,
        data: {
            caption?: string | null;
            category?: 'MENS' | 'KIDS';
            productId?: string | null;
            status?: 'PENDING' | 'APPROVED' | 'REJECTED';
        }
    ) {
        return prisma.reel.update({
            where: { id },
            data,
            include: { product: { select: productSelect } },
        });
    }

    async incrementViews(id: string) {
        await redis.hincrby(this.reelViewsBufferKey, id, 1);
    }

    async flushReelViews() {
        const buffer = await redis.hgetall(this.reelViewsBufferKey);
        const entries = Object.entries(buffer);

        if (entries.length === 0) {
            return { flushed: 0 };
        }

        for (const [reelId, count] of entries) {
            const increment = Number(count);
            if (!Number.isFinite(increment) || increment <= 0) {
                continue;
            }

            await prisma.reel.updateMany({
                where: { id: reelId },
                data: { views: { increment: Math.trunc(increment) } },
            });
        }

        await redis.del(this.reelViewsBufferKey);

        return { flushed: entries.length };
    }

    async delete(id: string) {
        return prisma.reel.delete({ where: { id } });
    }

    async existsProduct(productId: string, sellerId: string) {
        const product = await prisma.product.findFirst({
            where: { id: productId, sellerId },
            select: { id: true },
        });
        return !!product;
    }
}

export const reelRepository = new ReelRepository();
