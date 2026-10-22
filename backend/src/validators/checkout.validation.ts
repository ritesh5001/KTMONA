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
		/** COD = cash on delivery; omitted or ONLINE = pay with Razorpay. */
		paymentMethod: z.enum(['ONLINE', 'COD']).optional(),
		shippingName: z.string().min(1).optional(),
		shippingPhone: z.string().min(5).optional(),
		shippingEmail: z.string().email().optional(),
		shippingAddressLine1: z.string().min(1).optional(),
		shippingAddressLine2: z.string().optional(),
		shippingCity: z.string().min(1).optional(),
		shippingPincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional(),
		shippingNotes: z.string().max(500).optional(),
		/** One key per Place Order attempt; repeats return the same order. */
		checkoutKey: z.string().min(8).max(100).optional(),
	})
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Checkout Quote Validation Schema
 * POST /v1/checkout/quote — the full price breakup before placing the order.
 */
export const checkoutQuoteSchema = z.object({
	body: z.object({
		variantIds: z.array(z.string().min(1)).min(1).max(50).optional(),
		couponCode: z.string().min(1).max(64).optional(),
		paymentMethod: z.enum(['ONLINE', 'COD']).optional(),
	})
});
