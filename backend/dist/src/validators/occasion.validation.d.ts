import { z } from 'zod';
export declare const createOccasionSchema: z.ZodObject<{
    name: z.ZodString;
    image: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    image?: string | undefined;
}, {
    name: string;
    image?: string | undefined;
}>;
export declare const updateOccasionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
    name?: string | undefined;
    image?: string | null | undefined;
}, {
    isActive?: boolean | undefined;
    name?: string | undefined;
    image?: string | null | undefined;
}>;
export type CreateOccasionInput = z.infer<typeof createOccasionSchema>;
export type UpdateOccasionInput = z.infer<typeof updateOccasionSchema>;
//# sourceMappingURL=occasion.validation.d.ts.map