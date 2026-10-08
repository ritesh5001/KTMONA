import type { ReelQueryFilters } from '../types/reel.types.js';
export declare class ReelRepository {
    private readonly reelViewsBufferKey;
    create(data: {
        sellerId: string;
        videoUrl: string;
        thumbnailUrl?: string | undefined;
        caption?: string | undefined;
        category?: 'MENS' | 'KIDS' | undefined;
        productId?: string | undefined;
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
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
    }, unknown> & {}>;
    findByIdAndSeller(id: string, sellerId: string): Promise<({
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
    }, unknown> & {}) | null>;
    findById(id: string): Promise<({
        product: {
            readonly id: string;
            readonly title: string;
            readonly images: string[];
            readonly adminListingPrice: import("@prisma/client/runtime/index.js").Decimal | null;
            readonly sellerPrice: import("@prisma/client/runtime/index.js").Decimal;
            readonly status: import(".prisma/client").ProductStatus;
        } | null;
        seller: {
            readonly id: string;
            readonly email: string | null;
            readonly seller_profiles: {
                readonly store_name: string;
            } | null;
        };
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
    }, unknown> & {}) | null>;
    findBySeller(sellerId: string, filters: ReelQueryFilters): Promise<{
        reels: ({
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
        }, unknown> & {})[];
        total: number;
    }>;
    findAllAdmin(filters: ReelQueryFilters): Promise<{
        reels: ({
            product: {
                readonly id: string;
                readonly title: string;
                readonly images: string[];
                readonly adminListingPrice: import("@prisma/client/runtime/index.js").Decimal | null;
                readonly sellerPrice: import("@prisma/client/runtime/index.js").Decimal;
                readonly status: import(".prisma/client").ProductStatus;
            } | null;
            seller: {
                readonly id: string;
                readonly email: string | null;
                readonly seller_profiles: {
                    readonly store_name: string;
                } | null;
            };
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
        }, unknown> & {})[];
        total: number;
    }>;
    findPublished(filters: ReelQueryFilters): Promise<{
        reels: ({
            product: {
                readonly id: string;
                readonly title: string;
                readonly images: string[];
                readonly adminListingPrice: import("@prisma/client/runtime/index.js").Decimal | null;
                readonly sellerPrice: import("@prisma/client/runtime/index.js").Decimal;
                readonly status: import(".prisma/client").ProductStatus;
            } | null;
            seller: {
                readonly id: string;
                readonly email: string | null;
                readonly seller_profiles: {
                    readonly store_name: string;
                } | null;
            };
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
        }, unknown> & {})[];
        total: number;
    }>;
    findPublishedById(id: string): Promise<({
        product: {
            readonly id: string;
            readonly title: string;
            readonly images: string[];
            readonly adminListingPrice: import("@prisma/client/runtime/index.js").Decimal | null;
            readonly sellerPrice: import("@prisma/client/runtime/index.js").Decimal;
            readonly status: import(".prisma/client").ProductStatus;
        } | null;
        seller: {
            readonly id: string;
            readonly email: string | null;
            readonly seller_profiles: {
                readonly store_name: string;
            } | null;
        };
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
    }, unknown> & {}) | null>;
    updateStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<import("@prisma/client/runtime/index.js").GetResult<{
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
    }, unknown> & {}>;
    updateSellerFields(id: string, data: {
        caption?: string | null;
        category?: 'MENS' | 'KIDS';
        productId?: string | null;
        status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    }): Promise<{
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
    }, unknown> & {}>;
    incrementViews(id: string): Promise<void>;
    flushReelViews(): Promise<{
        flushed: number;
    }>;
    delete(id: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
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
    }, unknown> & {}>;
    existsProduct(productId: string, sellerId: string): Promise<boolean>;
}
export declare const reelRepository: ReelRepository;
//# sourceMappingURL=reel.repository.d.ts.map