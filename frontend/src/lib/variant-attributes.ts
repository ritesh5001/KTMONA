/**
 * Storefront-side rules for presenting variant attributes.
 *
 * The backend normalises what is *stored* (see
 * `backend/src/services/variant-attributes.service.ts`); this decides how the
 * result is ordered and grouped on the product page, so a size row reads
 * "36 38 40 42 44" / "S M L XL" instead of whatever order the rows were
 * inserted in.
 */

/** Display order for lettered sizes. Numeric sizes sort on their own value. */
const ALPHA_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];

const ALPHA_SIZE_ALIASES: Record<string, string> = {
    "2XL": "XXL",
    XXXL: "3XL",
    XXXXL: "4XL",
    SMALL: "S",
    MEDIUM: "M",
    LARGE: "L",
};

function sizeRank(size: string): [number, number, string] {
    const trimmed = size.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return [0, Number(trimmed), trimmed];

    const upper = trimmed.toUpperCase().replace(/\s+/g, "");
    const index = ALPHA_SIZE_ORDER.indexOf(ALPHA_SIZE_ALIASES[upper] ?? upper);
    if (index >= 0) return [1, index, trimmed];

    // "Free Size" and anything unrecognised trail the real scale.
    return [2, 0, trimmed];
}

export function compareSizes(left: string, right: string): number {
    const [leftGroup, leftValue, leftText] = sizeRank(left);
    const [rightGroup, rightValue, rightText] = sizeRank(right);
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    if (leftValue !== rightValue) return leftValue - rightValue;
    return leftText.localeCompare(rightText);
}

export interface SizeOption<TVariant> {
    size: string;
    variant: TVariant;
    stock: number | null;
    inStock: boolean;
    /** Set when stock is low enough to be worth nudging the buyer with. */
    lowStock: number | null;
}

const LOW_STOCK_THRESHOLD = 5;

/**
 * One chip per size of the chosen colour, in scale order.
 *
 * Stock is only treated as sold out when the API actually reported a count —
 * a missing `inventory` means "not tracked", and greying out every size would
 * be worse than letting the cart reject it.
 */
export function buildSizeOptions<
    TVariant extends { size: string; inventory?: { stock: number } | null },
>(variants: TVariant[]): SizeOption<TVariant>[] {
    const bySize = new Map<string, SizeOption<TVariant>>();

    for (const variant of variants) {
        const size = variant.size?.trim() || "Free Size";
        const stock = typeof variant.inventory?.stock === "number" ? variant.inventory.stock : null;
        const existing = bySize.get(size);

        // Duplicate sizes shouldn't survive normalisation, but if one does the
        // stocked row is the one worth showing.
        if (existing && !(stock !== null && stock > 0 && !existing.inStock)) continue;

        bySize.set(size, {
            size,
            variant,
            stock,
            inStock: stock === null || stock > 0,
            lowStock: stock !== null && stock > 0 && stock <= LOW_STOCK_THRESHOLD ? stock : null,
        });
    }

    return Array.from(bySize.values()).sort((left, right) => compareSizes(left.size, right.size));
}
