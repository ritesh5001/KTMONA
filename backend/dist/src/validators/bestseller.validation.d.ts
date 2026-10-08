import { z } from 'zod';
export declare const createBestsellerSchema: z.ZodObject<{
    productId: z.ZodString;
    position: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    position?: number | undefined;
}, {
    productId: string;
    position?: number | undefined;
}>;
export declare const updateBestsellerSchema: z.ZodObject<{
    position: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    position: number;
}, {
    position: number;
}>;
export type CreateBestsellerInput = z.infer<typeof createBestsellerSchema>;
export type UpdateBestsellerInput = z.infer<typeof updateBestsellerSchema>;
//# sourceMappingURL=bestseller.validation.d.ts.map