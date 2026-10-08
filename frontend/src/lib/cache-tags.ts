export const CACHE_TAGS = {
  products: "products",
  search: "search",
  categories: "categories",
  occasions: "occasions",
  orders: "orders",
  shipments: "shipments",
  payments: "payments",
  sellerProducts: "seller:products",
  sellerOrders: "seller:orders",
  adminProducts: "admin:products",
  userOrders: "user:orders",
} as const;

export function productTag(productId: string): string {
  return `product:${productId}`;
}

export function orderTag(orderId: string): string {
  return `order:${orderId}`;
}

export function collectionTag(slug: string): string {
  return `collection:${slug}`;
}

export function occasionTag(slug: string): string {
  return `occasion:${slug}`;
}

export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const sanitized = tags.filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  );
  return Array.from(new Set(sanitized));
}
