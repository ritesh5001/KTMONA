import { z } from 'zod';
export const createCategorySchema = z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters'),
    description: z.string().max(2000).optional(),
    image: z.string().url().optional(),
    bannerImage: z.string().url().optional(),
    parentId: z.string().optional(),
    sortOrder: z.number().int().min(0).optional(),
    seoTitle: z.string().max(120).optional(),
    seoDescription: z.string().max(320).optional(),
});
export const updateCategorySchema = z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters').optional(),
    description: z.string().max(2000).nullable().optional(),
    image: z.string().url().nullable().optional(),
    bannerImage: z.string().url().nullable().optional(),
    parentId: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    seoTitle: z.string().max(120).nullable().optional(),
    seoDescription: z.string().max(320).nullable().optional(),
});
//# sourceMappingURL=category.validation.js.map