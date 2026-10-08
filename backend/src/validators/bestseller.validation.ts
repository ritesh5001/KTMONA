import { z } from 'zod';

export const createBestsellerSchema = z.object({
    productId: z.string().min(1, 'Product ID is required'),
    position: z.number().int().min(0).optional(),
});

export const updateBestsellerSchema = z.object({
    position: z.number().int().min(0),
});

export type CreateBestsellerInput = z.infer<typeof createBestsellerSchema>;
export type UpdateBestsellerInput = z.infer<typeof updateBestsellerSchema>;
