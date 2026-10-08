import { z } from 'zod';
export declare const createReelSchema: z.ZodObject<{
    videoUrl: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    caption: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["MENS", "KIDS"]>>;
    productId: z.ZodOptional<z.ZodString>;
    durationSeconds: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    videoUrl: string;
    productId?: string | undefined;
    category?: "MENS" | "KIDS" | undefined;
    thumbnailUrl?: string | undefined;
    caption?: string | undefined;
    durationSeconds?: number | undefined;
}, {
    videoUrl: string;
    productId?: string | undefined;
    category?: "MENS" | "KIDS" | undefined;
    thumbnailUrl?: string | undefined;
    caption?: string | undefined;
    durationSeconds?: number | undefined;
}>;
export type CreateReelInput = z.infer<typeof createReelSchema>;
export declare const updateReelSchema: z.ZodEffects<z.ZodObject<{
    caption: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["MENS", "KIDS"]>>;
    productId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNull]>>;
}, "strip", z.ZodTypeAny, {
    productId?: string | null | undefined;
    category?: "MENS" | "KIDS" | undefined;
    caption?: string | undefined;
}, {
    productId?: string | null | undefined;
    category?: "MENS" | "KIDS" | undefined;
    caption?: string | undefined;
}>, {
    productId?: string | null | undefined;
    category?: "MENS" | "KIDS" | undefined;
    caption?: string | undefined;
}, {
    productId?: string | null | undefined;
    category?: "MENS" | "KIDS" | undefined;
    caption?: string | undefined;
}>;
export type UpdateReelInput = z.infer<typeof updateReelSchema>;
export declare const reelQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    category: z.ZodOptional<z.ZodEnum<["MENS", "KIDS"]>>;
    status: z.ZodOptional<z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
    category?: "MENS" | "KIDS" | undefined;
}, {
    status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
    limit?: string | undefined;
    category?: "MENS" | "KIDS" | undefined;
    page?: string | undefined;
}>;
export type ReelQueryInput = z.infer<typeof reelQuerySchema>;
//# sourceMappingURL=reel.validation.d.ts.map