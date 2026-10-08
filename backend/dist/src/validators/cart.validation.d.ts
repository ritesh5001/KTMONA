import { z } from 'zod';
/**
 * Add Cart Item Validation Schema
 * POST /v1/cart/items
 */
export declare const addCartItemSchema: z.ZodObject<{
    productId: z.ZodString;
    variantId: z.ZodString;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    variantId: string;
    productId: string;
    quantity: number;
}, {
    variantId: string;
    productId: string;
    quantity: number;
}>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
/**
 * Update Cart Item Validation Schema
 * PUT /v1/cart/items/:id
 */
export declare const updateCartItemSchema: z.ZodObject<{
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    quantity: number;
}, {
    quantity: number;
}>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
//# sourceMappingURL=cart.validation.d.ts.map