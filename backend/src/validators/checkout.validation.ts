import { z } from 'zod';

/**
 * Checkout Validation Schema
 * POST /v1/checkout
 */
export const checkoutSchema = z.object({
	body: z.object({
		/**
		 * Buy-now: check out only these variants instead of the whole cart.
		 * Omitted means the entire cart, which is the existing behaviour.
		 */
		variantIds: z.array(z.string().min(1)).min(1).max(50).optional(),
		couponCode: z.string().min(1).max(64).optional(),
		shippingName: z.string().min(1).optional(),
		shippingPhone: z.string().min(5).optional(),
		shippingEmail: z.string().email().optional(),
		shippingAddressLine1: z.string().min(1).optional(),
		shippingAddressLine2: z.string().optional(),
		shippingCity: z.string().min(1).optional(),
		shippingPincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional(),
		shippingNotes: z.string().optional(),
	})
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
