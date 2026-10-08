import { z } from 'zod';
/**
 * Create Variant Validation Schema
 * POST /v1/seller/products/:id/variants
 */
export declare const createVariantSchema: z.ZodObject<{
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
}>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
/**
 * Update Variant Validation Schema
 * PUT /v1/seller/variants/:id
 */
export declare const updateVariantSchema: z.ZodObject<{
    size: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    colorHex: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sku: z.ZodOptional<z.ZodString>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sellerPrice: z.ZodOptional<z.ZodNumber>;
    compareAtPrice: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    sellerPrice?: number | undefined;
    images?: string[] | undefined;
    size?: string | undefined;
    color?: string | null | undefined;
    colorHex?: string | null | undefined;
    sku?: string | undefined;
    compareAtPrice?: number | null | undefined;
}, {
    sellerPrice?: number | undefined;
    images?: string[] | undefined;
    size?: string | undefined;
    color?: string | null | undefined;
    colorHex?: string | null | undefined;
    sku?: string | undefined;
    compareAtPrice?: number | null | undefined;
}>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
/**
 * Update Stock Validation Schema
 * PUT /v1/seller/variants/:id/stock
 */
export declare const updateStockSchema: z.ZodObject<{
    stock: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    stock: number;
}, {
    stock: number;
}>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
//# sourceMappingURL=variant.validation.d.ts.map