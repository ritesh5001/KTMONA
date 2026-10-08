export declare class ReelEngagementRepository {
    findLike(reelId: string, userId: string): Promise<(import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        reelId: string;
        userId: string;
        createdAt: Date;
    }, unknown> & {}) | null>;
    createLike(reelId: string, userId: string): Promise<[import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        reelId: string;
        userId: string;
        createdAt: Date;
    }, unknown> & {}, import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        sellerId: string;
        productId: string | null;
        category: import(".prisma/client", { with: { "resolution-mode": "require" } }).ReelCategory;
        videoUrl: string;
        thumbnailUrl: string | null;
        caption: string | null;
        status: import(".prisma/client", { with: { "resolution-mode": "require" } }).ReelStatus;
        views: number;
        likes: number;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}]>;
    deleteLike(reelId: string, userId: string): Promise<[import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        reelId: string;
        userId: string;
        createdAt: Date;
    }, unknown> & {}, import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        sellerId: string;
        productId: string | null;
        category: import(".prisma/client", { with: { "resolution-mode": "require" } }).ReelCategory;
        videoUrl: string;
        thumbnailUrl: string | null;
        caption: string | null;
        status: import(".prisma/client", { with: { "resolution-mode": "require" } }).ReelStatus;
        views: number;
        likes: number;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}]>;
    hasUserLiked(reelId: string, userId: string): Promise<boolean>;
    findRecentView(reelId: string, userId: string, since: Date): Promise<{
        id: string;
    } | null>;
    createView(reelId: string, userId: string | null): Promise<[import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        reelId: string;
        userId: string | null;
        createdAt: Date;
    }, unknown> & {}, import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        sellerId: string;
        productId: string | null;
        category: import(".prisma/client", { with: { "resolution-mode": "require" } }).ReelCategory;
        videoUrl: string;
        thumbnailUrl: string | null;
        caption: string | null;
        status: import(".prisma/client", { with: { "resolution-mode": "require" } }).ReelStatus;
        views: number;
        likes: number;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}]>;
    createProductClick(reelId: string, productId: string, userId: string | null): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        reelId: string;
        userId: string | null;
        productId: string;
        createdAt: Date;
    }, unknown> & {}>;
    getReelAnalytics(reelId: string): Promise<{
        totalLikes: number;
        totalViews: number;
        totalProductClicks: number;
    }>;
    getSellerReelAnalytics(sellerId: string): Promise<{
        reelId: string;
        videoUrl: string;
        caption: string | null;
        status: import(".prisma/client", { with: { "resolution-mode": "require" } }).ReelStatus;
        views: number;
        likes: number;
        productClicks: number;
        createdAt: Date;
        product: {
            id: string;
            title: string;
        } | null;
    }[]>;
}
export declare const reelEngagementRepository: ReelEngagementRepository;
//# sourceMappingURL=reel-engagement.repository.d.ts.map