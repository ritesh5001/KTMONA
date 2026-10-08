import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
const productSelect = {
    id: true,
    title: true,
    images: true,
    adminListingPrice: true,
    sellerPrice: true,
    status: true,
};
const sellerSelect = {
    id: true,
    email: true,
    seller_profiles: {
        select: { store_name: true },
    },
};
export class ReelRepository {
    reelViewsBufferKey = 'reel:views:buffer';
    async create(data) {
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
    async findByIdAndSeller(id, sellerId) {
        return prisma.reel.findFirst({
            where: { id, sellerId },
            include: { product: { select: productSelect } },
        });
    }
    async findById(id) {
        return prisma.reel.findUnique({
            where: { id },
            include: {
                product: { select: productSelect },
                seller: { select: sellerSelect },
            },
        });
    }
    async findBySeller(sellerId, filters) {
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
    async findAllAdmin(filters) {
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
    async findPublished(filters) {
        const { page = 1, limit = 20, category } = filters;
        const skip = (page - 1) * limit;
        const where = {
            status: 'APPROVED',
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
    async findPublishedById(id) {
        return prisma.reel.findFirst({
            where: { id, status: 'APPROVED' },
            include: {
                product: { select: productSelect },
                seller: { select: sellerSelect },
            },
        });
    }
    async updateStatus(id, status) {
        return prisma.reel.update({
            where: { id },
            data: { status },
        });
    }
    async updateSellerFields(id, data) {
        return prisma.reel.update({
            where: { id },
            data,
            include: { product: { select: productSelect } },
        });
    }
    async incrementViews(id) {
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
    async delete(id) {
        return prisma.reel.delete({ where: { id } });
    }
    async existsProduct(productId, sellerId) {
        const product = await prisma.product.findFirst({
            where: { id: productId, sellerId },
            select: { id: true },
        });
        return !!product;
    }
}
export const reelRepository = new ReelRepository();
//# sourceMappingURL=reel.repository.js.map