import { z } from 'zod';
export declare const createCategorySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodString>;
    bannerImage: z.ZodOptional<z.ZodString>;
    parentId: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    seoTitle: z.ZodOptional<z.ZodString>;
    seoDescription: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    image?: string | undefined;
    bannerImage?: string | undefined;
    parentId?: string | undefined;
    sortOrder?: number | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    image?: string | undefined;
    bannerImage?: string | undefined;
    parentId?: string | undefined;
    sortOrder?: number | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
}>;
export declare const updateCategorySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    image: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    bannerImage: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    seoTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    seoDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    description?: string | null | undefined;
    isActive?: boolean | undefined;
    name?: string | undefined;
    image?: string | null | undefined;
    bannerImage?: string | null | undefined;
    parentId?: string | null | undefined;
    sortOrder?: number | undefined;
    seoTitle?: string | null | undefined;
    seoDescription?: string | null | undefined;
}, {
    description?: string | null | undefined;
    isActive?: boolean | undefined;
    name?: string | undefined;
    image?: string | null | undefined;
    bannerImage?: string | null | undefined;
    parentId?: string | null | undefined;
    sortOrder?: number | undefined;
    seoTitle?: string | null | undefined;
    seoDescription?: string | null | undefined;
}>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
//# sourceMappingURL=category.validation.d.ts.map