import { z } from 'zod';
export const validateCouponSchema = z.object({
    body: z.object({
        code: z.string().min(1).max(64),
    }),
});
//# sourceMappingURL=coupon.validation.js.map