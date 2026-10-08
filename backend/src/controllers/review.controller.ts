import { type NextFunction, type Request, type Response } from 'express';
import { ApiError } from '../errors/ApiError.js';
import { reviewService } from '../services/review.service.js';
import {
    createReviewSchema,
    reviewQuerySchema,
} from '../validators/review.validation.js';

/**
 * The product id arrives as `:id` on /v1/products/:id/reviews and as
 * `:productId` on the legacy /v1/reviews/product/:productId routes that shipped
 * mobile builds call.
 */
const firstParam = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

const resolveProductId = (req: Request): string => {
    const productId = firstParam(req.params['productId']) ?? firstParam(req.params['id']);
    if (!productId) {
        throw ApiError.badRequest('Product ID is required');
    }
    return productId;
};

/**
 * The web list is paginated; the legacy mobile route sends no query at all and
 * renders whatever it gets, so it asks for a bigger first page.
 */
const defaultLimitFor = (req: Request): number =>
    req.params['productId'] !== undefined ? 50 : 10;

export const reviewController = {
    createReview: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const productId = resolveProductId(req);
            const user = req.user;
            const userId = user?.userId;

            if (!userId) {
                throw ApiError.unauthorized('Unauthorized');
            }

            if (user?.role !== 'USER') {
                throw ApiError.forbidden('Only users can submit reviews');
            }

            const input = createReviewSchema.parse(req.body);

            const review = await reviewService.createReview(productId, userId, input);

            res.status(201).json({ message: 'Review submitted successfully', review });
        } catch (error) {
            next(error);
        }
    },

    getProductReviews: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const productId = resolveProductId(req);
            const query = reviewQuerySchema.parse(req.query);

            const result = await reviewService.getProductReviews(productId, {
                page: query.page ?? 1,
                limit: query.limit ?? defaultLimitFor(req),
                sort: query.sort ?? 'newest',
            });

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    },

    markHelpful: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = firstParam(req.params['id']);
            if (!id) {
                throw ApiError.badRequest('Review ID is required');
            }

            const updated = await reviewService.markHelpful(id);

            res.status(200).json({
                message: 'Marked as helpful',
                helpfulCount: updated.helpfulCount,
                review: updated,
            });
        } catch (error) {
            next(error);
        }
    },
};
