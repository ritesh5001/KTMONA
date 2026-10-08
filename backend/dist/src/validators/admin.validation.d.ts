/**
 * Admin Validation
 * Zod schemas for admin API request validation
 */
import { z } from 'zod';
export declare const sellerIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const productIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const productRejectSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const productSetPriceSchema: z.ZodObject<{
    adminListingPrice: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    adminListingPrice: number;
}, {
    adminListingPrice: number;
}>;
export declare const adminProductUpdateSchema: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodString>;
    audience: z.ZodOptional<z.ZodEnum<["MENS", "KIDS"]>>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    isPublished: z.ZodOptional<z.ZodBoolean>;
    occasionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    sellerPrice: z.ZodOptional<z.ZodNumber>;
    variants: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
        id: z.ZodString;
        size: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sku: z.ZodOptional<z.ZodString>;
        colorHex: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sellerPrice: z.ZodOptional<z.ZodNumber>;
        adminListingPrice: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        compareAtPrice: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        status: z.ZodOptional<z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>>;
        rejectionReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stock: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        sellerPrice?: number | undefined;
        adminListingPrice?: number | null | undefined;
        rejectionReason?: string | null | undefined;
        images?: string[] | undefined;
        size?: string | undefined;
        color?: string | null | undefined;
        colorHex?: string | null | undefined;
        sku?: string | undefined;
        compareAtPrice?: number | null | undefined;
        stock?: number | undefined;
    }, {
        id: string;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        sellerPrice?: number | undefined;
        adminListingPrice?: number | null | undefined;
        rejectionReason?: string | null | undefined;
        images?: string[] | undefined;
        size?: string | undefined;
        color?: string | null | undefined;
        colorHex?: string | null | undefined;
        sku?: string | undefined;
        compareAtPrice?: number | null | undefined;
        stock?: number | undefined;
    }>, {
        id: string;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        sellerPrice?: number | undefined;
        adminListingPrice?: number | null | undefined;
        rejectionReason?: string | null | undefined;
        images?: string[] | undefined;
        size?: string | undefined;
        color?: string | null | undefined;
        colorHex?: string | null | undefined;
        sku?: string | undefined;
        compareAtPrice?: number | null | undefined;
        stock?: number | undefined;
    }, {
        id: string;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        sellerPrice?: number | undefined;
        adminListingPrice?: number | null | undefined;
        rejectionReason?: string | null | undefined;
        images?: string[] | undefined;
        size?: string | undefined;
        color?: string | null | undefined;
        colorHex?: string | null | undefined;
        sku?: string | undefined;
        compareAtPrice?: number | null | undefined;
        stock?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    categoryId?: string | undefined;
    audience?: "MENS" | "KIDS" | undefined;
    title?: string | undefined;
    description?: string | undefined;
    sellerPrice?: number | undefined;
    isPublished?: boolean | undefined;
    images?: string[] | undefined;
    variants?: {
        id: string;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        sellerPrice?: number | undefined;
        adminListingPrice?: number | null | undefined;
        rejectionReason?: string | null | undefined;
        images?: string[] | undefined;
        size?: string | undefined;
        color?: string | null | undefined;
        colorHex?: string | null | undefined;
        sku?: string | undefined;
        compareAtPrice?: number | null | undefined;
        stock?: number | undefined;
    }[] | undefined;
    occasionIds?: string[] | undefined;
}, {
    categoryId?: string | undefined;
    audience?: "MENS" | "KIDS" | undefined;
    title?: string | undefined;
    description?: string | undefined;
    sellerPrice?: number | undefined;
    isPublished?: boolean | undefined;
    images?: string[] | undefined;
    variants?: {
        id: string;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        sellerPrice?: number | undefined;
        adminListingPrice?: number | null | undefined;
        rejectionReason?: string | null | undefined;
        images?: string[] | undefined;
        size?: string | undefined;
        color?: string | null | undefined;
        colorHex?: string | null | undefined;
        sku?: string | undefined;
        compareAtPrice?: number | null | undefined;
        stock?: number | undefined;
    }[] | undefined;
    occasionIds?: string[] | undefined;
}>;
export declare const orderIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const auditLogQuerySchema: z.ZodObject<{
    entityType: z.ZodOptional<z.ZodEnum<["USER", "PRODUCT", "ORDER", "PAYMENT"]>>;
    entityId: z.ZodOptional<z.ZodString>;
    actorId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    actorId?: string | undefined;
    entityType?: "USER" | "PRODUCT" | "ORDER" | "PAYMENT" | undefined;
    entityId?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    limit?: number | undefined;
    actorId?: string | undefined;
    entityType?: "USER" | "PRODUCT" | "ORDER" | "PAYMENT" | undefined;
    entityId?: string | undefined;
    page?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}>;
export type SellerIdParam = z.infer<typeof sellerIdParamSchema>;
export type ProductIdParam = z.infer<typeof productIdParamSchema>;
export type ProductRejectInput = z.infer<typeof productRejectSchema>;
export type ProductSetPriceInput = z.infer<typeof productSetPriceSchema>;
export type AdminProductUpdateInput = z.infer<typeof adminProductUpdateSchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
//# sourceMappingURL=admin.validation.d.ts.map