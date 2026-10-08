import { z } from 'zod';
export const createCommissionRuleSchema = z.object({
    sellerId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    commissionPercent: z.number().min(0).max(100),
    platformFee: z.number().min(0),
    isActive: z.boolean().optional().default(true),
});
export const updateCommissionRuleSchema = z.object({
    sellerId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    commissionPercent: z.number().min(0).max(100).optional(),
    platformFee: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
});
//# sourceMappingURL=commissionRule.validation.js.map