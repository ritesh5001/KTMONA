import { reelRepository } from '../repositories/reel.repository.js';
import { ApiError } from '../errors/ApiError.js';
import { compressReelVideo } from '../jobs/reel-compression.job.js';
import { CACHE_KEYS, getFromCache, setCache, invalidateCacheByPattern, } from '../utils/cache.util.js';
export class ReelService {
    reelRepo;
    constructor(reelRepo) {
        this.reelRepo = reelRepo;
    }
    // =========================================================================
    // SELLER ENDPOINTS
    // =========================================================================
    async createReel(sellerId, data) {
        // Validate product ownership if productId is provided
        if (data.productId) {
            const ownsProduct = await this.reelRepo.existsProduct(data.productId, sellerId);
            if (!ownsProduct) {
                throw ApiError.forbidden('Product does not belong to you');
            }
        }
        const reel = await this.reelRepo.create({
            sellerId,
            videoUrl: data.videoUrl,
            thumbnailUrl: data.thumbnailUrl,
            caption: data.caption,
            category: data.category,
            productId: data.productId,
        });
        await invalidateCacheByPattern('reels:public:*');
        // Fire-and-forget: compress video + extract metadata
        compressReelVideo(reel.id, reel.videoUrl).catch(() => { });
        return { message: 'Reel submitted for approval', reel };
    }
    async listSellerReels(sellerId, filters) {
        const { reels, total } = await this.reelRepo.findBySeller(sellerId, filters);
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        return {
            reels: reels.map((r) => ({
                ...r,
                sellerPrice: r.product ? Number(r.product.sellerPrice) : undefined,
                adminListingPrice: r.product?.adminListingPrice ? Number(r.product.adminListingPrice) : undefined,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async updateSellerReel(reelId, sellerId, data) {
        const reel = await this.reelRepo.findByIdAndSeller(reelId, sellerId);
        if (!reel) {
            throw ApiError.notFound('Reel not found or you do not have permission');
        }
        if (data.productId) {
            const ownsProduct = await this.reelRepo.existsProduct(data.productId, sellerId);
            if (!ownsProduct) {
                throw ApiError.forbidden('Product does not belong to you');
            }
        }
        const updateData = {
            status: 'PENDING',
        };
        if (data.caption !== undefined) {
            const trimmedCaption = data.caption.trim();
            updateData.caption = trimmedCaption.length > 0 ? trimmedCaption : null;
        }
        if (data.category !== undefined) {
            updateData.category = data.category;
        }
        if (data.productId !== undefined) {
            updateData.productId = data.productId;
        }
        const updated = await this.reelRepo.updateSellerFields(reelId, updateData);
        if (reel.status === 'APPROVED') {
            await invalidateCacheByPattern('reels:public:*');
        }
        return { message: 'Reel updated and sent for approval', reel: updated };
    }
    async deleteSellerReel(reelId, sellerId) {
        const reel = await this.reelRepo.findByIdAndSeller(reelId, sellerId);
        if (!reel) {
            throw ApiError.notFound('Reel not found or you do not have permission');
        }
        await this.reelRepo.delete(reelId);
        await invalidateCacheByPattern('reels:public:*');
        return { message: 'Reel deleted successfully' };
    }
    // =========================================================================
    // ADMIN ENDPOINTS
    // =========================================================================
    async listAdminReels(filters) {
        const { reels, total } = await this.reelRepo.findAllAdmin(filters);
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        return {
            reels: reels.map((r) => ({
                ...r,
                product: r.product
                    ? {
                        ...r.product,
                        sellerPrice: Number(r.product.sellerPrice),
                        adminListingPrice: r.product.adminListingPrice
                            ? Number(r.product.adminListingPrice)
                            : null,
                    }
                    : null,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async approveReel(reelId) {
        const reel = await this.reelRepo.findById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }
        const updated = await this.reelRepo.updateStatus(reelId, 'APPROVED');
        await invalidateCacheByPattern('reels:public:*');
        return { message: 'Reel approved successfully', reel: updated };
    }
    async rejectReel(reelId) {
        const reel = await this.reelRepo.findById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }
        const updated = await this.reelRepo.updateStatus(reelId, 'REJECTED');
        await invalidateCacheByPattern('reels:public:*');
        return { message: 'Reel rejected successfully', reel: updated };
    }
    async deleteReelAdmin(reelId) {
        const reel = await this.reelRepo.findById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }
        await this.reelRepo.delete(reelId);
        await invalidateCacheByPattern('reels:public:*');
        return { message: 'Reel deleted by admin' };
    }
    // =========================================================================
    // PUBLIC ENDPOINTS
    // =========================================================================
    async listPublicReels(filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const cacheKey = CACHE_KEYS.REELS_PUBLIC(page, limit, filters.category);
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const { reels, total } = await this.reelRepo.findPublished(filters);
        const response = {
            reels: reels.map((r) => ({
                ...r,
                product: r.product
                    ? {
                        ...r.product,
                        sellerPrice: Number(r.product.sellerPrice),
                        adminListingPrice: r.product.adminListingPrice
                            ? Number(r.product.adminListingPrice)
                            : null,
                    }
                    : null,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
        await setCache(cacheKey, response, 120);
        return response;
    }
    async getPublicReel(reelId) {
        const reel = await this.reelRepo.findPublishedById(reelId);
        if (!reel) {
            throw ApiError.notFound('Reel not found');
        }
        // Increment views in background (fire-and-forget)
        this.reelRepo.incrementViews(reelId).catch(() => { });
        return {
            reel: {
                ...reel,
                product: reel.product
                    ? {
                        ...reel.product,
                        sellerPrice: Number(reel.product.sellerPrice),
                        adminListingPrice: reel.product.adminListingPrice
                            ? Number(reel.product.adminListingPrice)
                            : null,
                    }
                    : null,
            },
        };
    }
}
export const reelService = new ReelService(reelRepository);
//# sourceMappingURL=reel.service.js.map