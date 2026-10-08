import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const labelEnum = z.enum(['HOME', 'OFFICE', 'OTHER']);

const pincode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Pincode must be 6 digits');

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createAddressSchema = z.object({
  label: labelEnum.optional().default('HOME'),
  addressLine1: z.string().trim().min(3, 'Address line 1 is required').max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, 'City is required').max(100),
  state: z.string().trim().min(2, 'State is required').max(100),
  pincode,
  isDefault: z.boolean().optional().default(false),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;

// ---------------------------------------------------------------------------
// Update (all optional — at least one validated in controller)
// ---------------------------------------------------------------------------

export const updateAddressSchema = z.object({
  label: labelEnum.optional(),
  addressLine1: z.string().trim().min(3).max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  pincode: pincode.optional(),
});

export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export const addressIdParamSchema = z.object({
  addressId: z.string().uuid('Invalid address ID'),
});
