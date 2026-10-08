/**
 * Shipment Validations
 * Zod schemas for shipping operations
 */
import { z } from 'zod';
export declare const createShipmentSchema: z.ZodObject<{
    carrier: z.ZodString;
    trackingNumber: z.ZodString;
}, "strip", z.ZodTypeAny, {
    carrier: string;
    trackingNumber: string;
}, {
    carrier: string;
    trackingNumber: string;
}>;
export declare const updateShipmentStatusSchema: z.ZodObject<{
    status: z.ZodNativeEnum<{
        CREATED: "CREATED";
        SHIPPED: "SHIPPED";
        DELIVERED: "DELIVERED";
    }>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "CREATED" | "SHIPPED" | "DELIVERED";
    note?: string | undefined;
}, {
    status: "CREATED" | "SHIPPED" | "DELIVERED";
    note?: string | undefined;
}>;
export declare const adminOverrideSchema: z.ZodObject<{
    status: z.ZodEnum<["SHIPPED", "DELIVERED"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "SHIPPED" | "DELIVERED";
    note: string;
}, {
    status: "SHIPPED" | "DELIVERED";
    note: string;
}>;
export type CreateShipmentSchema = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentStatusSchema = z.infer<typeof updateShipmentStatusSchema>;
export type AdminOverrideSchema = z.infer<typeof adminOverrideSchema>;
//# sourceMappingURL=shipment.validation.d.ts.map