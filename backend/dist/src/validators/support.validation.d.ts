import { z } from 'zod';
export declare const supportTicketCategorySchema: z.ZodEnum<["ORDER", "PAYMENT", "PRODUCT", "ACCOUNT", "SETTLEMENT", "OTHER"]>;
export declare const supportTicketStatusSchema: z.ZodEnum<["OPEN", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"]>;
export declare const createSupportTicketSchema: z.ZodObject<{
    subject: z.ZodString;
    category: z.ZodOptional<z.ZodEnum<["ORDER", "PAYMENT", "PRODUCT", "ACCOUNT", "SETTLEMENT", "OTHER"]>>;
    orderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    message: z.ZodString;
    attachments: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    message: string;
    subject: string;
    category?: "PRODUCT" | "ORDER" | "PAYMENT" | "OTHER" | "ACCOUNT" | "SETTLEMENT" | undefined;
    orderId?: string | null | undefined;
    attachments?: string[] | undefined;
}, {
    message: string;
    subject: string;
    category?: "PRODUCT" | "ORDER" | "PAYMENT" | "OTHER" | "ACCOUNT" | "SETTLEMENT" | undefined;
    orderId?: string | null | undefined;
    attachments?: string[] | undefined;
}>;
export declare const sendSupportMessageSchema: z.ZodObject<{
    body: z.ZodString;
    attachments: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    body: string;
    attachments?: string[] | undefined;
}, {
    body: string;
    attachments?: string[] | undefined;
}>;
export declare const updateSupportTicketSchema: z.ZodEffects<z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["OPEN", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"]>>;
    assigneeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "OPEN" | "AWAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | undefined;
    assigneeId?: string | null | undefined;
}, {
    status?: "OPEN" | "AWAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | undefined;
    assigneeId?: string | null | undefined;
}>, {
    status?: "OPEN" | "AWAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | undefined;
    assigneeId?: string | null | undefined;
}, {
    status?: "OPEN" | "AWAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | undefined;
    assigneeId?: string | null | undefined;
}>;
export declare const supportTicketListQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["OPEN", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"]>>;
    requesterRole: z.ZodOptional<z.ZodEnum<["USER", "SELLER"]>>;
    page: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status?: "OPEN" | "AWAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | undefined;
    limit?: number | undefined;
    requesterRole?: "USER" | "SELLER" | undefined;
    page?: number | undefined;
}, {
    status?: "OPEN" | "AWAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | undefined;
    limit?: number | undefined;
    requesterRole?: "USER" | "SELLER" | undefined;
    page?: number | undefined;
}>;
export declare const supportMessageListQuerySchema: z.ZodObject<{
    /** Cursor is a message id; results are the page of messages before it. */
    before: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    before?: string | undefined;
}, {
    limit?: number | undefined;
    before?: string | undefined;
}>;
export declare const supportTicketIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type SendSupportMessageInput = z.infer<typeof sendSupportMessageSchema>;
export type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;
export type SupportTicketListQuery = z.infer<typeof supportTicketListQuerySchema>;
export type SupportMessageListQuery = z.infer<typeof supportMessageListQuerySchema>;
//# sourceMappingURL=support.validation.d.ts.map