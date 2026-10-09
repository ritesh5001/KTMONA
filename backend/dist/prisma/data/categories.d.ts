/**
 * KTMONA storefront taxonomy.
 *
 * Three levels: main category → group → leaf. The 19 main categories are the
 * KTMONA list; groups and leaves follow Meesho's catalogue menu, with each
 * leaf living in exactly one place (Meesho repeats e.g. men's watches under
 * Men, Accessories and Watches; here they only sit under Watches).
 *
 * Sellers list products against leaves. Main categories and groups exist for
 * navigation and filtering; a product listed under a leaf shows up when a
 * shopper browses its group or main category.
 */
export interface CategoryGroup {
    name: string;
    items: string[];
}
export interface MainCategory {
    name: string;
    slug: string;
    description: string;
    groups: CategoryGroup[];
}
export declare const KTMONA_CATEGORIES: MainCategory[];
//# sourceMappingURL=categories.d.ts.map