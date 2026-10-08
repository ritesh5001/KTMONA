import { prisma } from '../config/db.js';
/**
 * Cart Repository
 * Handles database operations for shopping carts
 */
export class CartRepository {
    /**
     * Find cart by user ID with items (basic - no product/variant details)
     */
    async findByUserId(userId) {
        return prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
    }
    /**
     * Find or create cart for user.
     *
     * Read first: an upsert is a WRITE, and it was being paid on every single cart
     * interaction even though the row almost always already exists. The API and its
     * Postgres are in different regions, so that wasted round-trip is measured in
     * hundreds of milliseconds. Only brand-new users take the second query.
     */
    async findOrCreateByUserId(userId) {
        const existing = await prisma.cart.findUnique({ where: { userId } });
        if (existing) {
            return existing;
        }
        try {
            return await prisma.cart.create({ data: { userId } });
        }
        catch {
            // Lost a race with a concurrent request that created the cart first.
            const raced = await prisma.cart.findUnique({ where: { userId } });
            if (raced)
                return raced;
            throw new Error(`Unable to resolve cart for user ${userId}`);
        }
    }
    /**
     * Add item to cart (upsert - updates quantity if exists)
     */
    async addItem(cartId, data) {
        // Use upsert to handle unique constraint
        return prisma.cartItem.upsert({
            where: {
                cartId_variantId: {
                    cartId,
                    variantId: data.variantId,
                },
            },
            create: {
                cartId,
                productId: data.productId,
                variantId: data.variantId,
                quantity: data.quantity,
                priceSnapshot: data.priceSnapshot,
            },
            update: {
                quantity: data.quantity,
                priceSnapshot: data.priceSnapshot,
            },
        });
    }
    /**
     * Find cart item by ID
     */
    async findItemById(itemId) {
        return prisma.cartItem.findUnique({
            where: { id: itemId },
        });
    }
    /**
     * Find cart item by ID with cart (for ownership check)
     */
    async findItemByIdWithCart(itemId) {
        return prisma.cartItem.findUnique({
            where: { id: itemId },
            include: { cart: true },
        });
    }
    /**
     * Update item quantity
     */
    async updateItemQuantity(itemId, quantity, priceSnapshot) {
        return prisma.cartItem.update({
            where: { id: itemId },
            data: { quantity, priceSnapshot },
        });
    }
    /**
     * Remove item from cart
     */
    async removeItem(itemId) {
        await prisma.cartItem.delete({
            where: { id: itemId },
        });
    }
    /**
     * Clear all items from cart
     */
    async clearCart(cartId) {
        await prisma.cartItem.deleteMany({
            where: { cartId },
        });
    }
    /**
     * Get cart items with product and variant details
     * Uses batch lookups (2 queries) instead of 2N individual queries.
     */
    async getCartWithDetails(userId) {
        // Read-only in the common case — see findOrCreateByUserId. Viewing a cart used
        // to write to the database.
        let cart = await prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!cart) {
            const created = await this.findOrCreateByUserId(userId);
            cart = { ...created, items: [] };
        }
        if (cart.items.length === 0) {
            return { ...cart, items: [] };
        }
        // Batch lookup — 2 queries total instead of 2N
        const productIds = [...new Set(cart.items.map((item) => item.productId))];
        const variantIds = [...new Set(cart.items.map((item) => item.variantId))];
        const [products, variants] = await Promise.all([
            prisma.product.findMany({
                where: { id: { in: productIds } },
                // images/audience so the cart can render a real thumbnail rather
                // than a title and a quantity stepper.
                select: { id: true, title: true, sellerId: true, images: true },
            }),
            prisma.productVariant.findMany({
                where: { id: { in: variantIds } },
                select: {
                    id: true,
                    size: true,
                    sku: true,
                    color: true,
                    colorHex: true,
                    images: true,
                    price: true,
                    compareAtPrice: true,
                    inventory: { select: { stock: true } },
                },
            }),
        ]);
        const productMap = new Map(products.map((p) => [p.id, p]));
        const variantMap = new Map(variants.map((v) => [v.id, v]));
        const itemsWithDetails = cart.items.map((item) => {
            const product = productMap.get(item.productId);
            const variant = variantMap.get(item.variantId);
            return {
                ...item,
                product: product
                    ? { ...product }
                    : undefined,
                variant: variant
                    ? {
                        ...variant,
                        price: Number(variant.price),
                        compareAtPrice: variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
                    }
                    : undefined,
            };
        });
        return {
            ...cart,
            items: itemsWithDetails,
        };
    }
    /**
     * Load everything checkout needs about a cart in TWO round-trips.
     *
     * Checkout previously called getCartWithDetails() and then re-queried products
     * (for taxRate), variants (for seller/admin pricing) and seller_profiles (for the
     * seller's state) — six sequential queries where two suffice. With the database in
     * a different region than the API, each of those round-trips cost ~500ms.
     *
     * This is deliberately NOT folded into getCartWithDetails: the fields below include
     * sellerPrice and adminListingPrice, which must never reach a buyer-facing cart
     * response. Keep this method for internal pricing paths only.
     */
    async getCartForCheckout(userId) {
        // Deliberately raw SQL. Prisma 4 resolves every nested relation with its own
        // statement, so the equivalent typed query fanned out into seven sequential
        // round-trips (carts, cart_items, products, users, seller_profiles,
        // product_variants, inventory). At ~225ms per round-trip that alone was over a
        // second of pure waiting. One JOIN returns the same data in a single trip.
        //
        // Read-only and fully parameterised. LEFT JOINs are intentional: a missing
        // product/variant must surface as a validation error, not silently drop the row.
        return prisma.$queryRaw `
            SELECT
                c."id"                        AS "cartId",
                ci."id"                       AS "itemId",
                ci."quantity"                 AS "quantity",
                ci."product_id"               AS "productId",
                ci."variant_id"               AS "variantId",
                p."title"                     AS "productTitle",
                p."seller_id"                 AS "sellerId",
                p."tax_rate"                  AS "taxRate",
                p."status"::text              AS "productStatus",
                p."deleted_by_admin"          AS "productDeleted",
                v."price"                     AS "variantPrice",
                v."seller_price"              AS "variantSellerPrice",
                v."admin_listing_price"       AS "variantAdminPrice",
                v."status"::text              AS "variantStatus",
                COALESCE(i."stock", 0)        AS "stock",
                COALESCE(sp."state", '')      AS "sellerState"
            FROM "carts" c
            INNER JOIN "cart_items" ci     ON ci."cart_id"   = c."id"
            LEFT  JOIN "products" p        ON p."id"         = ci."product_id"
            LEFT  JOIN "product_variants" v ON v."id"        = ci."variant_id"
            LEFT  JOIN "inventory" i       ON i."variant_id" = ci."variant_id"
            LEFT  JOIN "seller_profiles" sp ON sp."user_id"  = p."seller_id"
            WHERE c."user_id" = ${userId}
            ORDER BY ci."created_at" DESC
        `;
    }
}
// Export singleton instance
export const cartRepository = new CartRepository();
//# sourceMappingURL=cart.repository.js.map