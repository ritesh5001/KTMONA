/**
 * Coupon Admin Validation Schemas
 * Zod schemas for admin coupon CRUD operations
 */
import { z } from 'zod';
export declare const createCouponSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    code: z.ZodEffects<z.ZodString, string, string>;
    type: z.ZodEnum<["PERCENT", "FLAT"]>;
    value: z.ZodNumber;
    maxDiscountAmount: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    minOrderAmount: z.ZodDefault<z.ZodNumber>;
    usageLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    perUserLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    validFrom: z.ZodDate;
    validUntil: z.ZodDate;
    isActive: z.ZodDefault<z.ZodBoolean>;
    sellerId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    firstTimeUserOnly: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    value: number;
    code: string;
    type: "PERCENT" | "FLAT";
    isActive: boolean;
    minOrderAmount: number;
    validFrom: Date;
    validUntil: Date;
    firstTimeUserOnly: boolean;
    sellerId?: string | null | undefined;
    maxDiscountAmount?: number | null | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
}, {
    value: number;
    code: string;
    type: "PERCENT" | "FLAT";
    validFrom: Date;
    validUntil: Date;
    sellerId?: string | null | undefined;
    isActive?: boolean | undefined;
    maxDiscountAmount?: number | null | undefined;
    minOrderAmount?: number | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
    firstTimeUserOnly?: boolean | undefined;
}>, {
    value: number;
    code: string;
    type: "PERCENT" | "FLAT";
    isActive: boolean;
    minOrderAmount: number;
    validFrom: Date;
    validUntil: Date;
    firstTimeUserOnly: boolean;
    sellerId?: string | null | undefined;
    maxDiscountAmount?: number | null | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
}, {
    value: number;
    code: string;
    type: "PERCENT" | "FLAT";
    validFrom: Date;
    validUntil: Date;
    sellerId?: string | null | undefined;
    isActive?: boolean | undefined;
    maxDiscountAmount?: number | null | undefined;
    minOrderAmount?: number | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
    firstTimeUserOnly?: boolean | undefined;
}>, {
    value: number;
    code: string;
    type: "PERCENT" | "FLAT";
    isActive: boolean;
    minOrderAmount: number;
    validFrom: Date;
    validUntil: Date;
    firstTimeUserOnly: boolean;
    sellerId?: string | null | undefined;
    maxDiscountAmount?: number | null | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
}, {
    value: number;
    code: string;
    type: "PERCENT" | "FLAT";
    validFrom: Date;
    validUntil: Date;
    sellerId?: string | null | undefined;
    isActive?: boolean | undefined;
    maxDiscountAmount?: number | null | undefined;
    minOrderAmount?: number | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
    firstTimeUserOnly?: boolean | undefined;
}>;
export declare const updateCouponSchema: z.ZodObject<{
    code: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    type: z.ZodOptional<z.ZodEnum<["PERCENT", "FLAT"]>>;
    value: z.ZodOptional<z.ZodNumber>;
    maxDiscountAmount: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    minOrderAmount: z.ZodOptional<z.ZodNumber>;
    usageLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    perUserLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    validFrom: z.ZodOptional<z.ZodDate>;
    validUntil: z.ZodOptional<z.ZodDate>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    sellerId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    firstTimeUserOnly: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    value?: number | undefined;
    code?: string | undefined;
    type?: "PERCENT" | "FLAT" | undefined;
    sellerId?: string | null | undefined;
    isActive?: boolean | undefined;
    maxDiscountAmount?: number | null | undefined;
    minOrderAmount?: number | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
    validFrom?: Date | undefined;
    validUntil?: Date | undefined;
    firstTimeUserOnly?: boolean | undefined;
}, {
    value?: number | undefined;
    code?: string | undefined;
    type?: "PERCENT" | "FLAT" | undefined;
    sellerId?: string | null | undefined;
    isActive?: boolean | undefined;
    maxDiscountAmount?: number | null | undefined;
    minOrderAmount?: number | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
    validFrom?: Date | undefined;
    validUntil?: Date | undefined;
    firstTimeUserOnly?: boolean | undefined;
}>;
export declare const couponQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    type: z.ZodOptional<z.ZodEnum<["PERCENT", "FLAT"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    type?: "PERCENT" | "FLAT" | undefined;
    search?: string | undefined;
    isActive?: "false" | "true" | undefined;
}, {
    type?: "PERCENT" | "FLAT" | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    isActive?: "false" | "true" | undefined;
    page?: number | undefined;
}>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type CouponQueryInput = z.infer<typeof couponQuerySchema>;
//# sourceMappingURL=couponAdmin.validation.d.ts.map