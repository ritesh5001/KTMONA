import { z } from 'zod';

const imageReferenceSchema = z
    .string()
    .min(1, 'User image is required')
    .refine((value) => /^(https?:\/\/|data:image\/(jpeg|jpg|png|webp);base64,)/i.test(value), {
        message: 'User image must be a public image URL or a base64 data URL',
    });

export const createTryOnSchema = z.object({
    body: z.object({
        productId: z.string().min(1, 'Product ID is required'),
        variantId: z.string().min(1).optional(),
        userImage: imageReferenceSchema,
        prompt: z.string().trim().max(300).optional(),
    }),
});

export type CreateTryOnInput = z.infer<typeof createTryOnSchema>['body'];
