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

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

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

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

/**
 * PATCH /v1/cart/items/:id/save-for-later
 */
export const saveForLaterSchema = z.object({
    saved: z.boolean(),
});

/**
 * PATCH /v1/cart/items/:id/variant — change size/colour
 */
export const changeCartVariantSchema = z.object({
    variantId: z.string().min(1, 'Variant ID is required'),
});

/**
 * POST /v1/cart/merge — a guest's on-device cart, added after they sign in.
 */
export const mergeCartSchema = z.object({
    items: z.array(addCartItemSchema).max(50),
});
