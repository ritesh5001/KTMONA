import { z } from 'zod';
export declare const createAppointmentSchema: z.ZodObject<{
    sellerId: z.ZodString;
    productId: z.ZodOptional<z.ZodString>;
    date: z.ZodEffects<z.ZodString, string, string>;
    time: z.ZodEffects<z.ZodString, string, string>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: string;
    sellerId: string;
    time: string;
    productId?: string | undefined;
    notes?: string | undefined;
}, {
    date: string;
    sellerId: string;
    time: string;
    productId?: string | undefined;
    notes?: string | undefined;
}>;
export declare const updateAppointmentStatusSchema: z.ZodObject<{
    appointmentId: z.ZodString;
    status: z.ZodEnum<["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "CANCELLED" | "COMPLETED" | "CONFIRMED";
    appointmentId: string;
}, {
    status: "PENDING" | "CANCELLED" | "COMPLETED" | "CONFIRMED";
    appointmentId: string;
}>;
export declare const rescheduleAppointmentSchema: z.ZodObject<{
    appointmentId: z.ZodString;
    date: z.ZodEffects<z.ZodString, string, string>;
    time: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    date: string;
    time: string;
    appointmentId: string;
}, {
    date: string;
    time: string;
    appointmentId: string;
}>;
export declare const blockSellerSchema: z.ZodObject<{
    sellerId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sellerId: string;
}, {
    sellerId: string;
}>;
export declare const upsertSellerAvailabilitySchema: z.ZodObject<{
    dayOfWeek: z.ZodNumber;
    startTime: z.ZodString;
    endTime: z.ZodString;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}, {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean | undefined;
}>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type BlockSellerInput = z.infer<typeof blockSellerSchema>;
export type UpsertSellerAvailabilityInput = z.infer<typeof upsertSellerAvailabilitySchema>;
//# sourceMappingURL=appointment.validation.d.ts.map