import { z } from 'zod';
/**
 * Seller Analytics query parameter validation schemas
 */
const isoDateString = z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid ISO date string' });
export const summaryQuerySchema = z.object({
    query: z.object({
        startDate: isoDateString.optional(),
        endDate: isoDateString.optional(),
    }),
});
export const chartQuerySchema = z.object({
    query: z.object({
        interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    }),
});
export const topProductsQuerySchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(20).default(10),
    }),
});
export const refundImpactQuerySchema = z.object({
    query: z.object({
        startDate: isoDateString.optional(),
        endDate: isoDateString.optional(),
    }),
});
//# sourceMappingURL=sellerAnalytics.validation.js.map