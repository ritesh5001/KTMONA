import { z } from 'zod';
export const createMediaSchema = z.object({
    type: z.enum(['IMAGE', 'VIDEO']),
    url: z.string().url('Invalid URL'),
    isThumbnail: z.boolean().optional().default(false),
    sortOrder: z.number().int().min(0).optional().default(0),
});
export const updateMediaSchema = z.object({
    type: z.enum(['IMAGE', 'VIDEO']).optional(),
    url: z.string().url('Invalid URL').optional(),
    isThumbnail: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
});
//# sourceMappingURL=media.validation.js.map