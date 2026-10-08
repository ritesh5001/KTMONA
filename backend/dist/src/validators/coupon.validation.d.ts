import { z } from 'zod';
export declare const validateCouponSchema: z.ZodObject<{
    body: z.ZodObject<{
        code: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
    }, {
        code: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        code: string;
    };
}, {
    body: {
        code: string;
    };
}>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
//# sourceMappingURL=coupon.validation.d.ts.map