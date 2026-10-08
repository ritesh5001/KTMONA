export const CACHE_TAGS = {
    products: 'products',
    search: 'search',
    categories: 'categories',
    occasions: 'occasions',
    orders: 'orders',
    shipments: 'shipments',
    payments: 'payments',
    sellerProducts: 'seller:products',
    sellerOrders: 'seller:orders',
    adminProducts: 'admin:products',
    userOrders: 'user:orders',
};
export function productTag(productId) {
    return `product:${productId}`;
}
export function orderTag(orderId) {
    return `order:${orderId}`;
}
export function collectionTag(slug) {
    return `collection:${slug}`;
}
export function occasionTag(slug) {
    return `occasion:${slug}`;
}
export function dedupeTags(tags) {
    return Array.from(new Set(tags.filter((tag) => typeof tag === 'string' && tag.length > 0)));
}
//# sourceMappingURL=cache-tags.js.map