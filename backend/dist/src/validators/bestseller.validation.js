import { z } from 'zod';
export const createBestsellerSchema = z.object({
    productId: z.string().min(1, 'Product ID is required'),
    position: z.number().int().min(0).optional(),
});
export const updateBestsellerSchema = z.object({
    position: z.number().int().min(0),
});
//# sourceMappingURL=bestseller.validation.js.map