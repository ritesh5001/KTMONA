export interface ReelEntity {
    id: string;
    sellerId: string;
    productId: string | null;
    videoUrl: string;
    thumbnailUrl: string | null;
    caption: string | null;
    category: 'MENS' | 'KIDS';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    views: number;
    likes: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface ReelWithProduct extends ReelEntity {
    product: {
        id: string;
        title: string;
        images: string[];
        adminListingPrice: number | null;
        sellerPrice: number;
        status: string;
    } | null;
}
export interface ReelWithDetails extends ReelEntity {
    product: {
        id: string;
        title: string;
        images: string[];
        adminListingPrice: number | null;
        sellerPrice: number;
        status: string;
    } | null;
    seller: {
        id: string;
        email: string | null;
        seller_profiles: {
            store_name: string;
        } | null;
    };
}
export interface CreateReelRequest {
    videoUrl: string;
    thumbnailUrl?: string | undefined;
    caption?: string | undefined;
    category?: 'MENS' | 'KIDS' | undefined;
    productId?: string | undefined;
    durationSeconds?: number | undefined;
}
export interface UpdateReelRequest {
    caption?: string | undefined;
    category?: 'MENS' | 'KIDS' | undefined;
    productId?: string | null | undefined;
}
export interface ReelQueryFilters {
    page?: number | undefined;
    limit?: number | undefined;
    category?: 'MENS' | 'KIDS' | undefined;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
}
export interface ReelListResponse {
    reels: ReelEntity[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface PublicReelListResponse {
    reels: ReelWithDetails[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface ReelDetailResponse {
    reel: ReelWithDetails;
}
export interface AdminReelListResponse {
    reels: ReelWithDetails[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface ReelLikeEntity {
    id: string;
    reelId: string;
    userId: string;
    createdAt: Date;
}
export interface ReelViewEntity {
    id: string;
    reelId: string;
    userId: string | null;
    createdAt: Date;
}
export interface ReelProductClickEntity {
    id: string;
    reelId: string;
    userId: string | null;
    productId: string;
    createdAt: Date;
}
export interface ReelAnalytics {
    totalViews: number;
    totalLikes: number;
    totalProductClicks: number;
}
export interface SellerReelAnalytics {
    reelId: string;
    videoUrl: string;
    caption: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    views: number;
    likes: number;
    productClicks: number;
    createdAt: Date;
    product: {
        id: string;
        title: string;
    } | null;
}
//# sourceMappingURL=reel.types.d.ts.map