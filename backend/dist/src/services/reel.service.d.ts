import { ReelRepository } from '../repositories/reel.repository.js';
import type { CreateReelRequest, UpdateReelRequest, ReelQueryFilters, ReelListResponse, PublicReelListResponse, ReelDetailResponse, AdminReelListResponse } from '../types/reel.types.js';
export declare class ReelService {
    private readonly reelRepo;
    constructor(reelRepo: ReelRepository);
    createReel(sellerId: string, data: CreateReelRequest): Promise<{
        message: string;
        reel: import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            productId: string | null;
            category: import(".prisma/client").ReelCategory;
            videoUrl: string;
            thumbnailUrl: string | null;
            caption: string | null;
            status: import(".prisma/client").ReelStatus;
            views: number;
            likes: number;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {};
    }>;
    listSellerReels(sellerId: string, filters: ReelQueryFilters): Promise<ReelListResponse>;
    updateSellerReel(reelId: string, sellerId: string, data: UpdateReelRequest): Promise<{
        message: string;
        reel: {
            product: {
                readonly id: string;
                readonly title: string;
                readonly images: string[];
                readonly adminListingPrice: import("@prisma/client/runtime/index.js").Decimal | null;
                readonly sellerPrice: import("@prisma/client/runtime/index.js").Decimal;
                readonly status: import(".prisma/client").ProductStatus;
            } | null;
        } & import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            productId: string | null;
            category: import(".prisma/client").ReelCategory;
            videoUrl: string;
            thumbnailUrl: string | null;
            caption: string | null;
            status: import(".prisma/client").ReelStatus;
            views: number;
            likes: number;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {};
    }>;
    deleteSellerReel(reelId: string, sellerId: string): Promise<{
        message: string;
    }>;
    listAdminReels(filters: ReelQueryFilters): Promise<AdminReelListResponse>;
    approveReel(reelId: string): Promise<{
        message: string;
        reel: import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            productId: string | null;
            category: import(".prisma/client").ReelCategory;
            videoUrl: string;
            thumbnailUrl: string | null;
            caption: string | null;
            status: import(".prisma/client").ReelStatus;
            views: number;
            likes: number;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {};
    }>;
    rejectReel(reelId: string): Promise<{
        message: string;
        reel: import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            productId: string | null;
            category: import(".prisma/client").ReelCategory;
            videoUrl: string;
            thumbnailUrl: string | null;
            caption: string | null;
            status: import(".prisma/client").ReelStatus;
            views: number;
            likes: number;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {};
    }>;
    deleteReelAdmin(reelId: string): Promise<{
        message: string;
    }>;
    listPublicReels(filters: ReelQueryFilters): Promise<PublicReelListResponse>;
    getPublicReel(reelId: string): Promise<ReelDetailResponse>;
}
export declare const reelService: ReelService;
//# sourceMappingURL=reel.service.d.ts.map