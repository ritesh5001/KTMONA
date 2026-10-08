/**
 * Variant attribute normalisation: colour names, swatch hexes and size labels.
 *
 * The catalogue was bulk-imported from vendor spreadsheets where the colour was
 * folded into the size cell ("GREEN38", "LB44") and the `color` column was left
 * empty, so the storefront had nothing to draw a swatch from and rendered every
 * product as a single "Default" colour with sizes that read like SKUs.
 *
 * This module is the one place that decides what a colour and a size *are*, so
 * the backfill script and the seller/admin write paths agree.
 */
/**
 * Canonical colour name -> swatch hex. Keys are lowercase with single spaces;
 * lookups go through `colorKey`. Multi-word entries must be listed here for the
 * greedy tokeniser to keep them together ("navy blue" beats "navy" + "blue").
 */
export declare const COLOR_LIBRARY: Record<string, string>;
/**
 * Vendor spellings mapped onto a name in the library. Keeps "Greay" off the
 * storefront while still letting it be recognised in a filename or a title.
 */
export declare const COLOR_ALIASES: Record<string, string>;
/** Folds a vendor spelling onto its library name. */
export declare function canonicalizeColor(name: string): string;
/** "navy blue" -> "Navy Blue". Preserves an already mixed-case vendor name. */
export declare function titleCaseColor(value: string): string;
/**
 * Swatch hex for a colour name. Falls back to the base colour when the name is
 * a modifier phrase we don't stock ("deep teal" -> teal, darkened).
 */
export declare function resolveColorHex(name?: string | null): string | null;
/**
 * Pulls the colour phrase out of free text — a product title or an image
 * filename. Returns the canonical multi-word name, or null.
 *
 * Scans right-to-left because vendors suffix the colour ("… Formal Trousers
 * Dark Brown", "2114DarkBlueFront").
 */
export declare function extractColorPhrase(text?: string | null): string | null;
export interface ParsedSize {
    /** Clean, buyer-facing size label: "38", "XL", "Free Size". */
    size: string;
    /** Colour text that had been glued onto the size cell, if any. */
    colorPrefix: string | null;
}
/**
 * Splits a vendor size cell into a real size and the colour that was glued to
 * it: "GREEN38" -> { size: "38", colorPrefix: "GREEN" }, "2xl" -> "XXL".
 */
export declare function parseSizeLabel(raw?: string | null): ParsedSize;
/** Sort key so "36" < "38" < "40" and XS < S < M < L < XL < XXL. */
export declare function sizeSortKey(size: string): [number, number, string];
export declare function compareSizes(left: string, right: string): number;
export interface VariantAttributeInput {
    size?: string | null | undefined;
    color?: string | null | undefined;
    colorHex?: string | null | undefined;
}
export interface NormalizedVariantAttributes {
    size: string | undefined;
    color: string | null | undefined;
    /**
     * Swatch implied by the colour name. Only a suggestion — callers apply it
     * after an explicit pick and an inherited sibling swatch, so clearing a
     * swatch on purpose still clears it.
     */
    derivedColorHex: string | null;
}
/**
 * Cleans a seller/admin variant payload before it is validated for uniqueness
 * and written.
 *
 * Sellers keep typing the colour into the size box ("Green 38"), which is how
 * the imported catalogue ended up with sizes that read like SKUs. Here the
 * colour is lifted out of the size, sizes are normalised to a single spelling
 * ("2xl" -> "XXL") so two spellings can't become two chips, and a recognised
 * colour name supplies its own swatch when nobody picked one.
 *
 * Only keys present on `input` come back, so this is safe for PATCH payloads.
 */
export declare function normalizeVariantAttributes(input: VariantAttributeInput): NormalizedVariantAttributes;
/** "Dark Blue" -> "DARKBLUE", for a readable SKU segment. */
export declare function skuColorSegment(color?: string | null): string;
/**
 * `<base>-<COLOUR>-<SIZE>`, e.g. "2114-DARKBLUE-38". Falls back to the base
 * plus size when the product has no colour axis.
 */
export declare function buildSku(base: string, color: string | null, size: string): string;
//# sourceMappingURL=variant-attributes.service.d.ts.map