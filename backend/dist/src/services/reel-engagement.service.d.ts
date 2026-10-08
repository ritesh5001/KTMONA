import { ReelEngagementRepository } from '../repositories/reel-engagement.repository.js';
import { ReelRepository } from '../repositories/reel.repository.js';
export declare class ReelEngagementService {
    private readonly engagementRepo;
    private readonly reelRepo;
    constructor(engagementRepo: ReelEngagementRepository, reelRepo: ReelRepository);
    likeReel(reelId: string, userId: string): Promise<{
        message: string;
        liked: boolean;
    }>;
    unlikeReel(reelId: string, userId: string): Promise<{
        message: string;
        liked: boolean;
    }>;
    hasLiked(reelId: string, userId: string): Promise<boolean>;
    recordView(reelId: string, userId: string | null): Promise<{
        message: string;
        recorded: boolean;
    }>;
    recordProductClick(reelId: string, userId: string | null): Promise<{
        message: string;
    }>;
    getReelAnalytics(reelId: string): Promise<{
        totalLikes: number;
        totalViews: number;
        totalProductClicks: number;
    }>;
    getSellerAnalytics(sellerId: string): Promise<{
        reelId: string;
        videoUrl: string;
        caption: string | null;
        status: import(".prisma/client").ReelStatus;
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
export declare const reelEngagementService: ReelEngagementService;
//# sourceMappingURL=reel-engagement.service.d.ts.map