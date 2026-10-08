/**
 * Coupon Admin Validation Schemas
 * Zod schemas for admin coupon CRUD operations
 */
import { z } from 'zod';
export const createCouponSchema = z.object({
    code: z.string().min(3).max(64).transform((v) => v.trim().toUpperCase()),
    type: z.enum(['PERCENT', 'FLAT']),
    value: z.number().positive(),
    maxDiscountAmount: z.number().positive().optional().nullable(),
    minOrderAmount: z.number().min(0).default(0),
    usageLimit: z.number().int().positive().optional().nullable(),
    perUserLimit: z.number().int().positive().optional().nullable(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    isActive: z.boolean().default(true),
    sellerId: z.string().uuid().optional().nullable(),
    firstTimeUserOnly: z.boolean().default(false),
}).refine((data) => data.validUntil > data.validFrom, {
    message: 'validUntil must be after validFrom',
    path: ['validUntil'],
}).refine((data) => {
    if (data.type === 'PERCENT' && data.value > 100)
        return false;
    return true;
}, {
    message: 'Percentage value cannot exceed 100',
    path: ['value'],
});
export const updateCouponSchema = z.object({
    code: z.string().min(3).max(64).transform((v) => v.trim().toUpperCase()).optional(),
    type: z.enum(['PERCENT', 'FLAT']).optional(),
    value: z.number().positive().optional(),
    maxDiscountAmount: z.number().positive().optional().nullable(),
    minOrderAmount: z.number().min(0).optional(),
    usageLimit: z.number().int().positive().optional().nullable(),
    perUserLimit: z.number().int().positive().optional().nullable(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
    sellerId: z.string().uuid().optional().nullable(),
    firstTimeUserOnly: z.boolean().optional(),
});
export const couponQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isActive: z.enum(['true', 'false']).optional(),
    type: z.enum(['PERCENT', 'FLAT']).optional(),
    search: z.string().max(64).optional(),
});
//# sourceMappingURL=couponAdmin.validation.js.map