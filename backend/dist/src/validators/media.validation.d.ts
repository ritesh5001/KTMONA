import { z } from 'zod';
export declare const createMediaSchema: z.ZodObject<{
    type: z.ZodEnum<["IMAGE", "VIDEO"]>;
    url: z.ZodString;
    isThumbnail: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    type: "IMAGE" | "VIDEO";
    sortOrder: number;
    url: string;
    isThumbnail: boolean;
}, {
    type: "IMAGE" | "VIDEO";
    url: string;
    sortOrder?: number | undefined;
    isThumbnail?: boolean | undefined;
}>;
export declare const updateMediaSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<["IMAGE", "VIDEO"]>>;
    url: z.ZodOptional<z.ZodString>;
    isThumbnail: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type?: "IMAGE" | "VIDEO" | undefined;
    sortOrder?: number | undefined;
    url?: string | undefined;
    isThumbnail?: boolean | undefined;
}, {
    type?: "IMAGE" | "VIDEO" | undefined;
    sortOrder?: number | undefined;
    url?: string | undefined;
    isThumbnail?: boolean | undefined;
}>;
export type CreateMediaInput = z.infer<typeof createMediaSchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;
//# sourceMappingURL=media.validation.d.ts.map