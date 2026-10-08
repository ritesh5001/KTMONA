import { z } from 'zod';
/**
 * Add Cart Item Validation Schema
 * POST /v1/cart/items
 */
export const addCartItemSchema = z.object({
    productId: z
        .string()
        .min(1, 'Product ID is required'),
    variantId: z
        .string()
        .min(1, 'Variant ID is required'),
    quantity: z
        .number()
        .int('Quantity must be an integer')
        .min(1, 'Quantity must be at least 1')
        .max(100, 'Quantity cannot exceed 100'),
});
/**
 * Update Cart Item Validation Schema
 * PUT /v1/cart/items/:id
 */
export const updateCartItemSchema = z.object({
    quantity: z
        .number()
        .int('Quantity must be an integer')
        .min(1, 'Quantity must be at least 1')
        .max(100, 'Quantity cannot exceed 100'),
});
//# sourceMappingURL=cart.validation.js.map