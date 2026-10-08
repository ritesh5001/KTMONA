import { z } from 'zod';
export const createReviewSchema = z
    .object({
    rating: z.coerce
        .number({ invalid_type_error: 'Rating must be a number' })
        .int('Rating must be a whole number')
        .min(1, 'Rating must be between 1 and 5')
        .max(5, 'Rating must be between 1 and 5'),
    title: z.string().trim().max(200, 'Title must be at most 200 characters').nullish(),
    // The web client posts `comment`; shipped mobile builds post `text`.
    text: z.string().trim().max(2000, 'Review must be at most 2000 characters').optional(),
    comment: z.string().trim().max(2000, 'Review must be at most 2000 characters').optional(),
    images: z
        .array(z.string().url('Review image must be a valid URL'))
        .max(3, 'Maximum 3 images allowed')
        .optional(),
})
    .transform((value) => ({
    rating: value.rating,
    title: value.title?.trim() ? value.title.trim() : null,
    text: (value.text ?? value.comment ?? '').trim(),
    images: value.images ?? [],
}))
    .refine((value) => value.text.length > 0, {
    message: 'Review text is required',
    path: ['text'],
});
export const reviewQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    sort: z.enum(['newest', 'oldest', 'highest', 'lowest', 'helpful']).optional(),
});
export const hideReviewSchema = z.object({
    isHidden: z.boolean(),
});
//# sourceMappingURL=review.validation.js.map