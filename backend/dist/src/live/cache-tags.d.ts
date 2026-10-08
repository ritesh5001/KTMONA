export declare const CACHE_TAGS: {
    readonly products: "products";
    readonly search: "search";
    readonly categories: "categories";
    readonly occasions: "occasions";
    readonly orders: "orders";
    readonly shipments: "shipments";
    readonly payments: "payments";
    readonly sellerProducts: "seller:products";
    readonly sellerOrders: "seller:orders";
    readonly adminProducts: "admin:products";
    readonly userOrders: "user:orders";
};
export declare function productTag(productId: string): string;
export declare function orderTag(orderId: string): string;
export declare function collectionTag(slug: string): string;
export declare function occasionTag(slug: string): string;
export declare function dedupeTags(tags: Array<string | null | undefined>): string[];
//# sourceMappingURL=cache-tags.d.ts.map