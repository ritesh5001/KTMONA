/**
 * Admin Validation
 * Zod schemas for admin API request validation
 */
import { z } from 'zod';
import { updateProductSchema } from './product.validation.js';
// ============================================================================
// SELLER MANAGEMENT
// ============================================================================
export const sellerIdParamSchema = z.object({
    id: z.string().min(1, 'Seller ID is required'),
});
// ============================================================================
// PRODUCT MODERATION
// ============================================================================
export const productIdParamSchema = z.object({
    id: z.string().min(1, 'Product ID is required'),
});
export const productRejectSchema = z.object({
    reason: z.string().min(1, 'Rejection reason is required').max(500),
});
export const productSetPriceSchema = z.object({
    adminListingPrice: z
        .number({ invalid_type_error: 'Admin listing price must be a number' })
        .positive('Admin listing price must be positive'),
});
const adminVariantUpdateSchema = z.object({
    id: z.string().min(1, 'Variant ID is required'),
    size: z
        .string({ invalid_type_error: 'Size must be a string' })
        .trim()
        .min(1, 'Size must be at least 1 character')
        .max(50, 'Size must be at most 50 characters')
        .optional(),
    color: z
        .string({ invalid_type_error: 'Color must be a string' })
        .trim()
        .min(1, 'Color must be at least 1 character')
        .max(50, 'Color must be at most 50 characters')
        .nullable()
        .optional(),
    sku: z
        .string({ invalid_type_error: 'SKU must be a string' })
        .trim()
        .min(1, 'SKU must be at least 1 character')
        .max(100, 'SKU must be at most 100 characters')
        .optional(),
    colorHex: z
        .string({ invalid_type_error: 'Colour code must be a string' })
        .trim()
        .regex(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Colour code must be a hex value like #B5651D')
        .nullable()
        .optional(),
    images: z
        .array(z.string().url('Variant image must be a valid URL'))
        .max(8, 'Maximum 8 variant images allowed')
        .optional(),
    sellerPrice: z
        .number({ invalid_type_error: 'Variant seller price must be a number' })
        .positive('Variant seller price must be positive')
        .optional(),
    // Nullable: the admin edit form sends null to clear a variant's listing price,
    // which is also the state every not-yet-priced variant is submitted in.
    adminListingPrice: z
        .number({ invalid_type_error: 'Variant admin listing price must be a number' })
        .positive('Variant admin listing price must be positive')
        .nullable()
        .optional(),
    compareAtPrice: z
        .number({ invalid_type_error: 'Compare-at price must be a number' })
        .nullable()
        .optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    rejectionReason: z
        .string({ invalid_type_error: 'Rejection reason must be a string' })
        .trim()
        .max(500, 'Rejection reason must be at most 500 characters')
        .nullable()
        .optional(),
    stock: z
        .number({ invalid_type_error: 'Stock must be a number' })
        .int('Stock must be an integer')
        .nonnegative('Stock must be zero or more')
        .optional(),
}).refine((value) => value.size !== undefined ||
    value.color !== undefined ||
    value.sku !== undefined ||
    value.colorHex !== undefined ||
    value.images !== undefined ||
    value.sellerPrice !== undefined ||
    value.adminListingPrice !== undefined ||
    value.compareAtPrice !== undefined ||
    value.status !== undefined ||
    value.rejectionReason !== undefined ||
    value.stock !== undefined, {
    message: 'Provide at least one field to update per variant',
});
export const adminProductUpdateSchema = updateProductSchema.extend({
    sellerPrice: z
        .number({ invalid_type_error: 'Seller price must be a number' })
        .positive('Seller price must be positive')
        .optional(),
    variants: z.array(adminVariantUpdateSchema).optional(),
});
// ============================================================================
// ORDER MANAGEMENT
// ============================================================================
export const orderIdParamSchema = z.object({
    id: z.string().min(1, 'Order ID is required'),
});
// ============================================================================
// AUDIT LOGS
// ============================================================================
export const auditLogQuerySchema = z.object({
    entityType: z.enum(['USER', 'PRODUCT', 'ORDER', 'PAYMENT']).optional(),
    entityId: z.string().optional(),
    actorId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
//# sourceMappingURL=admin.validation.js.map