import { z } from 'zod';
export declare const createAddressSchema: z.ZodObject<{
    label: z.ZodDefault<z.ZodOptional<z.ZodEnum<["HOME", "OFFICE", "OTHER"]>>>;
    addressLine1: z.ZodString;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodString;
    state: z.ZodString;
    pincode: z.ZodString;
    isDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    state: string;
    label: "HOME" | "OFFICE" | "OTHER";
    city: string;
    pincode: string;
    addressLine1: string;
    isDefault: boolean;
    addressLine2?: string | undefined;
}, {
    state: string;
    city: string;
    pincode: string;
    addressLine1: string;
    label?: "HOME" | "OFFICE" | "OTHER" | undefined;
    addressLine2?: string | undefined;
    isDefault?: boolean | undefined;
}>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export declare const updateAddressSchema: z.ZodObject<{
    label: z.ZodOptional<z.ZodEnum<["HOME", "OFFICE", "OTHER"]>>;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    pincode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    state?: string | undefined;
    label?: "HOME" | "OFFICE" | "OTHER" | undefined;
    city?: string | undefined;
    pincode?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
}, {
    state?: string | undefined;
    label?: "HOME" | "OFFICE" | "OTHER" | undefined;
    city?: string | undefined;
    pincode?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
}>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export declare const addressIdParamSchema: z.ZodObject<{
    addressId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    addressId: string;
}, {
    addressId: string;
}>;
//# sourceMappingURL=address.validator.d.ts.map