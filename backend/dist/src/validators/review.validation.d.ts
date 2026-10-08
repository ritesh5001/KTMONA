import { z } from 'zod';
export declare const createReviewSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    rating: z.ZodNumber;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    text: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodString>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    rating: number;
    title?: string | null | undefined;
    images?: string[] | undefined;
    text?: string | undefined;
    comment?: string | undefined;
}, {
    rating: number;
    title?: string | null | undefined;
    images?: string[] | undefined;
    text?: string | undefined;
    comment?: string | undefined;
}>, {
    rating: number;
    title: string | null;
    text: string;
    images: string[];
}, {
    rating: number;
    title?: string | null | undefined;
    images?: string[] | undefined;
    text?: string | undefined;
    comment?: string | undefined;
}>, {
    rating: number;
    title: string | null;
    text: string;
    images: string[];
}, {
    rating: number;
    title?: string | null | undefined;
    images?: string[] | undefined;
    text?: string | undefined;
    comment?: string | undefined;
}>;
export declare const reviewQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
    sort: z.ZodOptional<z.ZodEnum<["newest", "oldest", "highest", "lowest", "helpful"]>>;
}, "strip", z.ZodTypeAny, {
    sort?: "oldest" | "highest" | "lowest" | "helpful" | "newest" | undefined;
    limit?: number | undefined;
    page?: number | undefined;
}, {
    sort?: "oldest" | "highest" | "lowest" | "helpful" | "newest" | undefined;
    limit?: number | undefined;
    page?: number | undefined;
}>;
export declare const hideReviewSchema: z.ZodObject<{
    isHidden: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    isHidden: boolean;
}, {
    isHidden: boolean;
}>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReviewQueryInput = z.infer<typeof reviewQuerySchema>;
export type HideReviewInput = z.infer<typeof hideReviewSchema>;
//# sourceMappingURL=review.validation.d.ts.map