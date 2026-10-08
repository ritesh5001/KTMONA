export interface RecommendedProduct {
    id: string;
    title: string;
    description: string | null;
    images: string[];
    sellerPrice: number;
    adminListingPrice: number | null;
    category: {
        id: string;
        name: string;
    } | null;
    recommendationScore: number;
}
export declare function scoreRecommendationCandidate(params: {
    categoryFrequency: number;
    affinityScore: number;
    recentlyViewedRank: number;
}): number;
export declare class RecommendationService {
    getRecommendations(userId: string): Promise<RecommendedProduct[]>;
}
export declare const recommendationService: RecommendationService;
//# sourceMappingURL=recommendation.service.d.ts.map