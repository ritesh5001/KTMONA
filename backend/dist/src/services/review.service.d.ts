interface CreateReviewInput {
    rating: number;
    title?: string | null;
    text: string;
    images?: string[];
}
interface ReviewQuery {
    page: number;
    limit: number;
    sort: string;
}
interface ReviewAuthor {
    id: string;
    email: string;
    fullName: string;
    avatar: string | null;
}
export declare class ReviewService {
    /**
     * Create a review (one per user per product)
     */
    createReview(productId: string, userId: string, input: CreateReviewInput): Promise<{
        id: string;
        rating: number;
        title: string | null;
        text: string;
        images: string[];
        helpfulCount: number;
        createdAt: Date;
        user: ReviewAuthor;
    }>;
    /**
     * Get reviews for a product with pagination, sorting, and rating summary
     */
    getProductReviews(productId: string, query: ReviewQuery): Promise<any>;
    /**
     * Mark a review as helpful (increment counter)
     */
    markHelpful(reviewId: string): Promise<{
        id: string;
        helpfulCount: number;
    }>;
    /**
     * Set hidden state on a review (admin)
     */
    setHidden(reviewId: string, isHidden: boolean): Promise<import("@prisma/client/runtime/index.js").GetResult<{
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
    /**
     * List all reviews for admin (includes hidden)
     */
    listReviews(params?: {
        page?: number;
        limit?: number;
    }): Promise<{
        reviews: {
            id: any;
            rating: any;
            title: any;
            text: any;
            images: any;
            helpfulCount: any;
            isHidden: any;
            createdAt: any;
            product: {
                id: any;
                title: any;
            };
            user: {
                id: any;
                email: any;
                fullName: any;
                avatar: any;
            };
        }[];
    }>;
    deleteReview(id: string): Promise<void>;
}
export declare const reviewService: ReviewService;
export {};
//# sourceMappingURL=review.service.d.ts.map