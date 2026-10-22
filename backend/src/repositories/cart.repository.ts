import { prisma } from '../config/db.js';
import type {
    CartEntity,
    CartItemEntity,
    CartWithItems,
    AddCartItemRequest,
    CartItemAvailability,
    CartVariantOption,
} from '../types/cart.types.js';

/** At or below this many units a line shows "Only N left". */
const LOW_STOCK_THRESHOLD = 5;
/** Same cap as the add/update validators. */
const MAX_CART_QUANTITY = 100;

/**
 * One cart line joined with everything checkout needs to price and validate it.
 * Produced by CartRepository.getCartForCheckout — internal pricing use only, since
 * it carries seller cost prices that must never reach a buyer-facing response.
 */
export interface CheckoutCartRow {
    cartId: string;
    itemId: string;
    quantity: number;
    productId: string;
    variantId: string;
    productTitle: string | null;
    sellerId: string | null;
    taxRate: number | null;
    productStatus: string | null;
    productDeleted: boolean | null;
    /** Seller paused the listing (or holiday mode); not purchasable. */
    productPaused: boolean | null;
    variantPrice: number | null;
    variantSellerPrice: number | null;
    variantAdminPrice: number | null;
    variantStatus: string | null;
    variantCompareAtPrice: number | null;
    variantSize: string | null;
    variantColor: string | null;
    productImage: string | null;
    variantImage: string | null;
    stock: number;
    sellerState: string;
}

/**
 * Cart Repository
 * Handles database operations for shopping carts
 */
export class CartRepository {
    /**
     * Find cart by user ID with items (basic - no product/variant details)
     */
    async findByUserId(userId: string) {
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
    async findOrCreateByUserId(userId: string): Promise<CartEntity> {
        const existing = await prisma.cart.findUnique({ where: { userId } });
        if (existing) {
            return existing;
        }

        try {
            return await prisma.cart.create({ data: { userId } });
        } catch {
            // Lost a race with a concurrent request that created the cart first.
            const raced = await prisma.cart.findUnique({ where: { userId } });
            if (raced) return raced;
            throw new Error(`Unable to resolve cart for user ${userId}`);
        }
    }

    /**
     * Add item to cart (upsert - updates quantity if exists)
     */
    async addItem(
        cartId: string,
        data: AddCartItemRequest & { priceSnapshot: number }
    ): Promise<CartItemEntity> {
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
                // Adding a saved item again brings it back to the cart.
                savedForLater: false,
            },
        });
    }

    /** Move a line between the cart and "saved for later". */
    async setSavedForLater(itemId: string, savedForLater: boolean): Promise<CartItemEntity> {
        return prisma.cartItem.update({ where: { id: itemId }, data: { savedForLater } });
    }

    /**
     * Swap a line to another size/colour of the same product. If that variant is
     * already in the cart the two lines are merged.
     */
    async changeVariant(
        item: CartItemEntity,
        variantId: string,
        priceSnapshot: number,
        maxQuantity: number,
    ): Promise<CartItemEntity> {
        return prisma.$transaction(async (tx) => {
            const existing = await tx.cartItem.findUnique({
                where: { cartId_variantId: { cartId: item.cartId, variantId } },
            });
            if (existing) {
                await tx.cartItem.delete({ where: { id: item.id } });
                return tx.cartItem.update({
                    where: { id: existing.id },
                    data: {
                        quantity: Math.min(existing.quantity + item.quantity, maxQuantity),
                        priceSnapshot,
                        savedForLater: item.savedForLater,
                    },
                });
            }
            return tx.cartItem.update({
                where: { id: item.id },
                data: { variantId, priceSnapshot, quantity: Math.min(item.quantity, maxQuantity) },
            });
        });
    }

    /**
     * Find cart item by ID
     */
    async findItemById(itemId: string): Promise<CartItemEntity | null> {
        return prisma.cartItem.findUnique({
            where: { id: itemId },
        });
    }

    /**
     * Find cart item by ID with cart (for ownership check)
     */
    async findItemByIdWithCart(itemId: string): Promise<(CartItemEntity & { cart: CartEntity }) | null> {
        return prisma.cartItem.findUnique({
            where: { id: itemId },
            include: { cart: true },
        });
    }

    /**
     * Update item quantity
     */
    async updateItemQuantity(itemId: string, quantity: number, priceSnapshot: number): Promise<CartItemEntity> {
        return prisma.cartItem.update({
            where: { id: itemId },
            data: { quantity, priceSnapshot },
        });
    }

    /**
     * Remove item from cart
     */
    async removeItem(itemId: string): Promise<void> {
        await prisma.cartItem.delete({
            where: { id: itemId },
        });
    }

    /**
     * Clear all items from cart
     */
    async clearCart(cartId: string): Promise<void> {
        await prisma.cartItem.deleteMany({
            where: { cartId },
        });
    }

    /**
     * Get cart items with product and variant details
     * Uses batch lookups (2 queries) instead of 2N individual queries.
     */
    async getCartWithDetails(userId: string): Promise<CartWithItems | null> {
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
            return { ...cart, items: [], savedItems: [] };
        }

        // Batch lookup — 2 queries total instead of 2N
        const productIds = [...new Set(cart.items.map((item) => item.productId))];
        const variantIds = [...new Set(cart.items.map((item) => item.variantId))];

        const [products, variants, siblings] = await Promise.all([
            prisma.product.findMany({
                where: { id: { in: productIds } },
                // images/audience so the cart can render a real thumbnail rather
                // than a title and a quantity stepper.
                select: {
                    id: true,
                    title: true,
                    sellerId: true,
                    images: true,
                    status: true,
                    deletedByAdmin: true,
                    pausedBySeller: true,
                    pausedForVacation: true,
                    isReturnable: true,
                },
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
                    status: true,
                    inventory: { select: { stock: true } },
                },
            }),
            // Every approved size/colour of these products, for "change size/colour".
            prisma.productVariant.findMany({
                where: { productId: { in: productIds }, status: 'APPROVED' },
                select: {
                    id: true,
                    productId: true,
                    size: true,
                    color: true,
                    colorHex: true,
                    price: true,
                    inventory: { select: { stock: true } },
                },
                orderBy: [{ color: 'asc' }, { size: 'asc' }],
            }),
        ]);

        const productMap = new Map(products.map((p) => [p.id, p]));
        const variantMap = new Map(variants.map((v) => [v.id, v]));
        const optionsByProduct = new Map<string, CartVariantOption[]>();
        for (const v of siblings) {
            const list = optionsByProduct.get(v.productId) ?? [];
            list.push({
                id: v.id,
                size: v.size,
                color: v.color,
                colorHex: v.colorHex,
                price: Number(v.price),
                stock: v.inventory?.stock ?? 0,
            });
            optionsByProduct.set(v.productId, list);
        }

        const itemsWithDetails = cart.items.map((item) => {
            const product = productMap.get(item.productId);
            const variant = variantMap.get(item.variantId);
            const stock = variant?.inventory?.stock ?? 0;
            const purchasable = Boolean(
                product &&
                variant &&
                product.status === 'APPROVED' &&
                !product.deletedByAdmin &&
                !product.pausedBySeller &&
                !product.pausedForVacation &&
                variant.status === 'APPROVED',
            );
            const currentPrice = variant ? Number(variant.price) : item.priceSnapshot;
            const status: CartItemAvailability['status'] = !purchasable
                ? 'UNAVAILABLE'
                : stock <= 0
                    ? 'OUT_OF_STOCK'
                    : stock <= LOW_STOCK_THRESHOLD
                        ? 'LOW_STOCK'
                        : 'IN_STOCK';

            return {
                ...item,
                product: product
                    ? {
                        id: product.id,
                        title: product.title,
                        sellerId: product.sellerId,
                        images: product.images,
                        isReturnable: product.isReturnable,
                    }
                    : undefined,
                variant: variant
                    ? {
                        id: variant.id,
                        size: variant.size,
                        sku: variant.sku,
                        color: variant.color,
                        colorHex: variant.colorHex,
                        images: variant.images,
                        inventory: variant.inventory,
                        price: currentPrice,
                        compareAtPrice:
                            variant.compareAtPrice == null ? null : Number(variant.compareAtPrice),
                    }
                    : undefined,
                availability: {
                    status,
                    stock,
                    maxQuantity: purchasable ? Math.min(stock, MAX_CART_QUANTITY) : 0,
                    priceChange: Math.round((currentPrice - item.priceSnapshot) * 100) / 100,
                    quantityTooHigh: purchasable && stock > 0 && item.quantity > stock,
                },
                options: (optionsByProduct.get(item.productId) ?? []).filter(
                    (o) => o.id === item.variantId || o.stock > 0,
                ),
            };
        });

        return {
            ...cart,
            items: itemsWithDetails.filter((item) => !item.savedForLater),
            savedItems: itemsWithDetails.filter((item) => item.savedForLater),
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
    async getCartForCheckout(userId: string): Promise<CheckoutCartRow[]> {
        // Deliberately raw SQL. Prisma 4 resolves every nested relation with its own
        // statement, so the equivalent typed query fanned out into seven sequential
        // round-trips (carts, cart_items, products, users, seller_profiles,
        // product_variants, inventory). At ~225ms per round-trip that alone was over a
        // second of pure waiting. One JOIN returns the same data in a single trip.
        //
        // Read-only and fully parameterised. LEFT JOINs are intentional: a missing
        // product/variant must surface as a validation error, not silently drop the row.
        return prisma.$queryRaw<CheckoutCartRow[]>`
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
                (p."paused_by_seller" OR p."paused_for_vacation") AS "productPaused",
                v."price"                     AS "variantPrice",
                v."seller_price"              AS "variantSellerPrice",
                v."admin_listing_price"       AS "variantAdminPrice",
                v."status"::text              AS "variantStatus",
                v."compare_at_price"          AS "variantCompareAtPrice",
                v."size"                      AS "variantSize",
                v."color"                     AS "variantColor",
                p."images"[1]                 AS "productImage",
                v."images"[1]                 AS "variantImage",
                COALESCE(i."stock", 0)        AS "stock",
                COALESCE(sp."state", '')      AS "sellerState"
            FROM "carts" c
            INNER JOIN "cart_items" ci     ON ci."cart_id"   = c."id"
            LEFT  JOIN "products" p        ON p."id"         = ci."product_id"
            LEFT  JOIN "product_variants" v ON v."id"        = ci."variant_id"
            LEFT  JOIN "inventory" i       ON i."variant_id" = ci."variant_id"
            LEFT  JOIN "seller_profiles" sp ON sp."user_id"  = p."seller_id"
            WHERE c."user_id" = ${userId}
              AND ci."saved_for_later" = false
            ORDER BY ci."created_at" DESC
        `;
    }
}

// Export singleton instance
export const cartRepository = new CartRepository();
