import { z } from 'zod';
export declare const productAudienceSchema: z.ZodEnum<["MENS", "KIDS"]>;
/**
 * Create Product Validation Schema
 * POST /v1/seller/products
 */
export declare const createProductSchema: z.ZodObject<{
    categoryId: z.ZodString;
    audience: z.ZodDefault<z.ZodEnum<["MENS", "KIDS"]>>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    isPublished: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    occasionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    variants: z.ZodArray<z.ZodObject<{
        size: z.ZodString;
        color: z.ZodOptional<z.ZodString>;
        colorHex: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sku: z.ZodString;
        sellerPrice: z.ZodNumber;
        compareAtPrice: z.ZodOptional<z.ZodNumber>;
        initialStock: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        sellerPrice: number;
        size: string;
        sku: string;
        initialStock: number;
        images?: string[] | undefined;
        color?: string | undefined;
        colorHex?: string | null | undefined;
        compareAtPrice?: number | undefined;
    }, {
        sellerPrice: number;
        size: string;
        sku: string;
        images?: string[] | undefined;
        color?: string | undefined;
        colorHex?: string | null | undefined;
        compareAtPrice?: number | undefined;
        initialStock?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    categoryId: string;
    audience: "MENS" | "KIDS";
    title: string;
    isPublished: boolean;
    variants: {
        sellerPrice: number;
        size: string;
        sku: string;
        initialStock: number;
        images?: string[] | undefined;
        color?: string | undefined;
        colorHex?: string | null | undefined;
        compareAtPrice?: number | undefined;
    }[];
    description?: string | undefined;
    images?: string[] | undefined;
    occasionIds?: string[] | undefined;
}, {
    categoryId: string;
    title: string;
    variants: {
        sellerPrice: number;
        size: string;
        sku: string;
        images?: string[] | undefined;
        color?: string | undefined;
        colorHex?: string | null | undefined;
        compareAtPrice?: number | undefined;
        initialStock?: number | undefined;
    }[];
    audience?: "MENS" | "KIDS" | undefined;
    description?: string | undefined;
    isPublished?: boolean | undefined;
    images?: string[] | undefined;
    occasionIds?: string[] | undefined;
}>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
/**
 * Update Product Validation Schema
 * PUT /v1/seller/products/:id
 */
export declare const updateProductSchema: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodString>;
    audience: z.ZodOptional<z.ZodEnum<["MENS", "KIDS"]>>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    isPublished: z.ZodOptional<z.ZodBoolean>;
    occasionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    categoryId?: string | undefined;
    audience?: "MENS" | "KIDS" | undefined;
    title?: string | undefined;
    description?: string | undefined;
    isPublished?: boolean | undefined;
    images?: string[] | undefined;
    occasionIds?: string[] | undefined;
}, {
    categoryId?: string | undefined;
    audience?: "MENS" | "KIDS" | undefined;
    title?: string | undefined;
    description?: string | undefined;
    isPublished?: boolean | undefined;
    images?: string[] | undefined;
    occasionIds?: string[] | undefined;
}>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
/**
 * Product Query Validation Schema
 * GET /v1/products
 */
export declare const productQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    categoryId: z.ZodOptional<z.ZodString>;
    audience: z.ZodOptional<z.ZodEnum<["MENS", "KIDS"]>>;
    search: z.ZodOptional<z.ZodString>;
    occasion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    search?: string | undefined;
    categoryId?: string | undefined;
    audience?: "MENS" | "KIDS" | undefined;
    occasion?: string | undefined;
}, {
    limit?: string | undefined;
    search?: string | undefined;
    categoryId?: string | undefined;
    audience?: "MENS" | "KIDS" | undefined;
    occasion?: string | undefined;
    page?: string | undefined;
}>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
//# sourceMappingURL=product.validation.d.ts.map