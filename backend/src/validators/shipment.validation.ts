/**
 * Shipment Validations
 * Zod schemas for shipping operations
 */

import { z } from 'zod';
import { ShipmentStatus } from '@prisma/client';

export const createShipmentSchema = z.object({
    carrier: z.string()
        .min(1, 'Carrier name is required')
        .max(100, 'Carrier name too long'),
    trackingNumber: z.string()
        .min(1, 'Tracking number is required')
        .max(100, 'Tracking number too long')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid tracking number format')
});

export const updateShipmentStatusSchema = z.object({
    status: z.nativeEnum(ShipmentStatus, {
        errorMap: () => ({ message: 'Invalid shipment status' })
    }),
    note: z.string().optional()
});

export const adminOverrideSchema = z.object({
    status: z.enum(['SHIPPED', 'DELIVERED']),
    note: z.string().min(1, 'Reason for override is required')
});

export type CreateShipmentSchema = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentStatusSchema = z.infer<typeof updateShipmentStatusSchema>;
export type AdminOverrideSchema = z.infer<typeof adminOverrideSchema>;
