export declare class ReviewRepository {
    findAll(params?: {
        skip?: number;
        take?: number;
    }): Promise<({
        product: {
            id: string;
            title: string;
        };
        user: {
            id: string;
            email: string | null;
            user_profiles: {
                full_name: string;
                avatar: string | null;
            } | null;
        };
    } & import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        userId: string;
        rating: number;
        title: string | null;
        text: string;
        images: string[];
        helpfulCount: number;
        isHidden: boolean;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {})[]>;
    deleteById(id: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        productId: string;
        userId: string;
        rating: number;
        title: string | null;
        text: string;
        images: string[];
        helpfulCount: number;
        isHidden: boolean;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
}
export declare const reviewRepository: ReviewRepository;
//# sourceMappingURL=review.repository.d.ts.map