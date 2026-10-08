import { z } from 'zod';
/**
 * Checkout Validation Schema
 * POST /v1/checkout
 */
export declare const checkoutSchema: z.ZodObject<{
    body: z.ZodObject<{
        /**
         * Buy-now: check out only these variants instead of the whole cart.
         * Omitted means the entire cart, which is the existing behaviour.
         */
        variantIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        couponCode: z.ZodOptional<z.ZodString>;
        shippingName: z.ZodOptional<z.ZodString>;
        shippingPhone: z.ZodOptional<z.ZodString>;
        shippingEmail: z.ZodOptional<z.ZodString>;
        shippingAddressLine1: z.ZodOptional<z.ZodString>;
        shippingAddressLine2: z.ZodOptional<z.ZodString>;
        shippingCity: z.ZodOptional<z.ZodString>;
        shippingPincode: z.ZodOptional<z.ZodString>;
        shippingNotes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        couponCode?: string | undefined;
        shippingName?: string | undefined;
        shippingPhone?: string | undefined;
        shippingEmail?: string | undefined;
        shippingAddressLine1?: string | undefined;
        shippingAddressLine2?: string | undefined;
        shippingCity?: string | undefined;
        shippingPincode?: string | undefined;
        shippingNotes?: string | undefined;
        variantIds?: string[] | undefined;
    }, {
        couponCode?: string | undefined;
        shippingName?: string | undefined;
        shippingPhone?: string | undefined;
        shippingEmail?: string | undefined;
        shippingAddressLine1?: string | undefined;
        shippingAddressLine2?: string | undefined;
        shippingCity?: string | undefined;
        shippingPincode?: string | undefined;
        shippingNotes?: string | undefined;
        variantIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        couponCode?: string | undefined;
        shippingName?: string | undefined;
        shippingPhone?: string | undefined;
        shippingEmail?: string | undefined;
        shippingAddressLine1?: string | undefined;
        shippingAddressLine2?: string | undefined;
        shippingCity?: string | undefined;
        shippingPincode?: string | undefined;
        shippingNotes?: string | undefined;
        variantIds?: string[] | undefined;
    };
}, {
    body: {
        couponCode?: string | undefined;
        shippingName?: string | undefined;
        shippingPhone?: string | undefined;
        shippingEmail?: string | undefined;
        shippingAddressLine1?: string | undefined;
        shippingAddressLine2?: string | undefined;
        shippingCity?: string | undefined;
        shippingPincode?: string | undefined;
        shippingNotes?: string | undefined;
        variantIds?: string[] | undefined;
    };
}>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
//# sourceMappingURL=checkout.validation.d.ts.map