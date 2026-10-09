import { z } from 'zod';
export declare const bannerSchema: z.ZodObject<{
    imageUrl: z.ZodString;
    mobileImageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    href: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    alt: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    imageUrl: string;
    alt: string;
    mobileImageUrl?: string | null | undefined;
    href?: string | null | undefined;
}, {
    imageUrl: string;
    mobileImageUrl?: string | null | undefined;
    href?: string | null | undefined;
    alt?: string | undefined;
}>;
export declare const homeBannersSchema: z.ZodObject<{
    hero: z.ZodDefault<z.ZodArray<z.ZodObject<{
        imageUrl: z.ZodString;
        mobileImageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        href: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        alt: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        imageUrl: string;
        alt: string;
        mobileImageUrl?: string | null | undefined;
        href?: string | null | undefined;
    }, {
        imageUrl: string;
        mobileImageUrl?: string | null | undefined;
        href?: string | null | undefined;
        alt?: string | undefined;
    }>, "many">>;
    promo: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        imageUrl: z.ZodString;
        mobileImageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        href: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        alt: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        imageUrl: string;
        alt: string;
        mobileImageUrl?: string | null | undefined;
        href?: string | null | undefined;
    }, {
        imageUrl: string;
        mobileImageUrl?: string | null | undefined;
        href?: string | null | undefined;
        alt?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    hero: {
        imageUrl: string;
        alt: string;
        mobileImageUrl?: string | null | undefined;
        href?: string | null | undefined;
    }[];
    promo: {
        imageUrl: string;
        alt: string;
        mobileImageUrl?: string | null | undefined;
        href?: string | null | undefined;
    } | null;
}, {
    hero?: {
        imageUrl: string;
        mobileImageUrl?: string | null | undefined;
        href?: string | null | undefined;
        alt?: string | undefined;
    }[] | undefined;
    promo?: {
        imageUrl: string;
        mobileImageUrl?: string | null | undefined;
        href?: string | null | undefined;
        alt?: string | undefined;
    } | null | undefined;
}>;
export type HomeBanners = z.infer<typeof homeBannersSchema>;
export declare const storefrontService: {
    getBanners(): Promise<HomeBanners>;
    saveBanners(input: unknown): Promise<HomeBanners>;
};
//# sourceMappingURL=storefront.service.d.ts.map