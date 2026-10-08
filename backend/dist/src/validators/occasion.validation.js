import { z } from 'zod';
export const createOccasionSchema = z.object({
    name: z.string().min(2, 'Occasion name must be at least 2 characters').max(100),
    image: z.string().url('Image must be a valid URL').optional(),
});
export const updateOccasionSchema = z.object({
    name: z.string().min(2, 'Occasion name must be at least 2 characters').max(100).optional(),
    image: z.string().url('Image must be a valid URL').nullable().optional(),
    isActive: z.boolean().optional(),
});
//# sourceMappingURL=occasion.validation.js.map