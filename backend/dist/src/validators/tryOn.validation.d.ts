import { z } from 'zod';
export declare const createTryOnSchema: z.ZodObject<{
    body: z.ZodObject<{
        productId: z.ZodString;
        variantId: z.ZodOptional<z.ZodString>;
        userImage: z.ZodEffects<z.ZodString, string, string>;
        prompt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        userImage: string;
        variantId?: string | undefined;
        prompt?: string | undefined;
    }, {
        productId: string;
        userImage: string;
        variantId?: string | undefined;
        prompt?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        productId: string;
        userImage: string;
        variantId?: string | undefined;
        prompt?: string | undefined;
    };
}, {
    body: {
        productId: string;
        userImage: string;
        variantId?: string | undefined;
        prompt?: string | undefined;
    };
}>;
export type CreateTryOnInput = z.infer<typeof createTryOnSchema>['body'];
//# sourceMappingURL=tryOn.validation.d.ts.map