type VariantImageCarrier = {
    id: string;
    color?: string | null;
    images?: string[] | null;
};
export declare function normalizeVariantColorKey(color?: string | null): string;
export declare function sanitizeVariantImages(images?: string[] | null): string[];
export declare function arraysEqual(left: string[], right: string[]): boolean;
export declare function resolveColorScopedGallery(variants: Array<{
    color?: string | null;
    images?: string[] | null;
}>, color?: string | null): string[];
export declare function applyColorScopedImages<T extends VariantImageCarrier>(variants: T[]): Array<T & {
    images: string[];
}>;
export declare function buildColorScopedImageUpdates<T extends VariantImageCarrier>(variants: T[]): Array<{
    id: string;
    images: string[];
}>;
/**
 * A colour's swatch belongs to the colour, not to one size of it. Given the
 * variants of a product, resolve the hex every variant of each colour should
 * carry: an explicit value on any sibling wins, so setting the swatch once
 * applies it across that colour's sizes.
 */
export declare function applyColorScopedHex<T extends {
    id: string;
    color?: string | null;
    colorHex?: string | null;
}>(variants: T[]): Array<T & {
    colorHex: string | null;
}>;
/** Accepts `#rgb` or `#rrggbb` (case-insensitive), normalised to lowercase #rrggbb. */
export declare function sanitizeColorHex(value?: string | null): string | null;
/** The swatch already in use for a colour on this product, if any. */
export declare function resolveColorScopedHex(variants: Array<{
    color?: string | null;
    colorHex?: string | null;
}>, color?: string | null): string | null;
export {};
//# sourceMappingURL=color-variant-images.service.d.ts.map