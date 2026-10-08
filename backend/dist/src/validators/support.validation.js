import { z } from 'zod';
const messageBody = z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message must be at most 4000 characters');
const attachments = z
    .array(z.string().url('Attachment must be a valid URL'))
    .max(5, 'Maximum 5 attachments allowed')
    .optional();
export const supportTicketCategorySchema = z.enum([
    'ORDER',
    'PAYMENT',
    'PRODUCT',
    'ACCOUNT',
    'SETTLEMENT',
    'OTHER',
]);
export const supportTicketStatusSchema = z.enum([
    'OPEN',
    'AWAITING_CUSTOMER',
    'RESOLVED',
    'CLOSED',
]);
export const createSupportTicketSchema = z.object({
    subject: z
        .string({ required_error: 'Subject is required' })
        .trim()
        .min(3, 'Subject must be at least 3 characters')
        .max(200, 'Subject must be at most 200 characters'),
    category: supportTicketCategorySchema.optional(),
    orderId: z.string().trim().min(1).max(100).nullish(),
    message: messageBody,
    attachments,
});
export const sendSupportMessageSchema = z.object({
    body: messageBody,
    attachments,
});
export const updateSupportTicketSchema = z
    .object({
    status: supportTicketStatusSchema.optional(),
    assigneeId: z.string().trim().min(1).nullish(),
})
    .refine((value) => value.status !== undefined || value.assigneeId !== undefined, { message: 'Provide a status or an assignee to update' });
export const supportTicketListQuerySchema = z.object({
    status: supportTicketStatusSchema.optional(),
    requesterRole: z.enum(['USER', 'SELLER']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
});
export const supportMessageListQuerySchema = z.object({
    /** Cursor is a message id; results are the page of messages before it. */
    before: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const supportTicketIdParamSchema = z.object({
    id: z.string().min(1, 'Ticket ID is required'),
});
//# sourceMappingURL=support.validation.js.map