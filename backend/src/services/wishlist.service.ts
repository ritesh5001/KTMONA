import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import { ApiError } from '../errors/ApiError.js';
import { wishlistLogger } from '../config/logger.js';
import { wishlistAddTotal, wishlistRemoveTotal } from '../config/metrics.js';
import { CACHE_KEYS, getFromCache, invalidateCache, setCache } from '../utils/cache.util.js';

const CATEGORY_AFFINITY_KEY_PREFIX = 'user_category_affinity:';
const WISHLIST_CACHE_TTL_SECONDS = 45;

function categoryAffinityKey(userId: string): string {
    return `${CATEGORY_AFFINITY_KEY_PREFIX}${userId}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WishlistItemDetail {
    id: string;
    productId: string;
    createdAt: string;
    product: {
        id: string;
        title: string;
        description: string | null;
        images: string[];
        sellerPrice: number | null;
        adminListingPrice: number | null;
        price: number;
        adminPrice: number;
        salePrice: number;
        regularPrice: number;
        isPublished: boolean;
        category: { id: string; name: string } | null;
    };
}

export interface WishlistResponse {
    wishlist: {
        id: string;
        userId: string;
        items: WishlistItemDetail[];
    };
}

export interface WishlistToggleResponse {
    message: string;
    added: boolean;
    productId: string;
}

export interface WishlistCountResponse {
    count: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WishlistService {
    /**
     * Get or create the user's wishlist (idempotent).
     */
    private async findOrCreateWishlist(userId: string) {
        const existing = await prisma.wishlist.findUnique({
            where: { userId },
        });
        if (existing) return existing;
        try {
            return await prisma.wishlist.create({ data: { userId } });
        } catch (error: any) {
            // P2002 race: concurrent creation — re-fetch
            if (error?.code === 'P2002' || String(error?.message ?? '').includes('Unique constraint')) {
                const raced = await prisma.wishlist.findUnique({ where: { userId } });
                if (raced) return raced;
            }
            throw error;
        }
    }

    /**
     * List all wishlist items with product details.
     */
    async getWishlist(userId: string): Promise<WishlistResponse> {
        const cacheKey = CACHE_KEYS.USER_WISHLIST(userId);
        const cached = await getFromCache<WishlistResponse>(cacheKey);
        if (cached) return cached;

        const wishlist = await this.findOrCreateWishlist(userId);

        const items = await prisma.wishlistItem.findMany({
            where: { wishlistId: wishlist.id },
            orderBy: { createdAt: 'desc' },
            take: 500,
            include: {
                product: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        images: true,
                        sellerPrice: true,
                        adminListingPrice: true,
                        isPublished: true,
                        category: { select: { id: true, name: true } },
                        variants: {
                            where: { status: 'APPROVED' },
                            orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
                            take: 1,
                            select: { price: true, compareAtPrice: true },
                        },
                    },
                },
            },
        });

        const response = {
            wishlist: {
                id: wishlist.id,
                userId: wishlist.userId,
                items: items.map((i) => {
                    const { variants, ...product } = i.product;
                    const cheapestVariant = variants[0];
                    const fallbackSellingPrice = Math.max(
                        Number(product.adminListingPrice ?? 0),
                        Number(product.sellerPrice ?? 0),
                    );
                    const variantPrice = Number(cheapestVariant?.price ?? 0);
                    const sellingPrice =
                        Number.isFinite(variantPrice) && variantPrice > 0
                            ? variantPrice
                            : fallbackSellingPrice;
                    const compareAtPrice = Number(cheapestVariant?.compareAtPrice ?? 0);
                    const regularPrice = Math.max(
                        sellingPrice,
                        Number.isFinite(compareAtPrice) && compareAtPrice > 0 ? compareAtPrice : 0,
                    );

                    return {
                        id: i.id,
                        productId: i.productId,
                        createdAt: i.createdAt.toISOString(),
                        product: {
                            ...product,
                            // Preserve the legacy fields for the existing web
                            // client while exposing the same canonical public
                            // pricing contract used by `/v1/products`.
                            sellerPrice: product.sellerPrice === null ? null : Number(product.sellerPrice),
                            adminListingPrice:
                                product.adminListingPrice === null ? null : Number(product.adminListingPrice),
                            price: sellingPrice,
                            adminPrice: sellingPrice,
                            salePrice: sellingPrice,
                            regularPrice,
                        },
                    };
                }),
            },
        };
        await setCache(cacheKey, response, WISHLIST_CACHE_TTL_SECONDS);
        return response;
    }

    /**
     * Toggle a product in the wishlist using an idempotent upsert / delete.
     * Returns whether the item was added or removed.
     */
    async toggleItem(userId: string, productId: string): Promise<WishlistToggleResponse> {
        const [product, wishlist] = await Promise.all([
            prisma.product.findUnique({
                where: { id: productId },
                select: { id: true, categoryId: true, isPublished: true, deletedByAdmin: true, status: true },
            }),
            this.findOrCreateWishlist(userId),
        ]);

        if (!product) {
            throw ApiError.notFound('Product not found');
        }
        if (product.deletedByAdmin || product.status !== 'APPROVED' || !product.isPublished) {
            throw ApiError.badRequest('Product is not available');
        }

        // Check if item already exists
        const existing = await prisma.wishlistItem.findUnique({
            where: {
                wishlistId_productId: {
                    wishlistId: wishlist.id,
                    productId,
                },
            },
        });

        if (existing) {
            // Remove
            await prisma.wishlistItem.delete({ where: { id: existing.id } });
            await invalidateCache(CACHE_KEYS.USER_WISHLIST(userId), CACHE_KEYS.USER_WISHLIST_COUNT(userId));
            wishlistRemoveTotal.inc();
            wishlistLogger.info({ userId, productId }, 'wishlist_item_removed');
            return { message: 'Removed from wishlist', added: false, productId };
        }

        // Add
        try {
            await prisma.wishlistItem.create({
                data: { wishlistId: wishlist.id, productId },
            });
        } catch (error: any) {
            // P2002 race: concurrent add — item already exists, treat as idempotent success
            if (error?.code === 'P2002' || String(error?.message ?? '').includes('Unique constraint')) {
                return { message: 'Added to wishlist', added: true, productId };
            }
            throw error;
        }
        await redis.zincrby(categoryAffinityKey(userId), 1, product.categoryId);
        await invalidateCache(CACHE_KEYS.USER_WISHLIST(userId), CACHE_KEYS.USER_WISHLIST_COUNT(userId));
        wishlistAddTotal.inc();
        wishlistLogger.info({ userId, productId, categoryId: product.categoryId }, 'wishlist_item_added');
        return { message: 'Added to wishlist', added: true, productId };
    }

    /**
     * Explicitly add a product to the wishlist (idempotent).
     */
    async addItem(userId: string, productId: string): Promise<WishlistToggleResponse> {
        const [product, wishlist] = await Promise.all([
            prisma.product.findUnique({
                where: { id: productId },
                select: { id: true, categoryId: true, isPublished: true, deletedByAdmin: true, status: true },
            }),
            this.findOrCreateWishlist(userId),
        ]);

        if (!product) {
            throw ApiError.notFound('Product not found');
        }
        if (product.deletedByAdmin || product.status !== 'APPROVED' || !product.isPublished) {
            throw ApiError.badRequest('Product is not available');
        }

        // Upsert — if it already exists, no-op
        const existing = await prisma.wishlistItem.findUnique({
            where: {
                wishlistId_productId: {
                    wishlistId: wishlist.id,
                    productId,
                },
            },
        });

        if (!existing) {
            try {
                await prisma.wishlistItem.create({
                    data: { wishlistId: wishlist.id, productId },
                });
                await redis.zincrby(categoryAffinityKey(userId), 1, product.categoryId);
                await invalidateCache(CACHE_KEYS.USER_WISHLIST(userId), CACHE_KEYS.USER_WISHLIST_COUNT(userId));
                wishlistAddTotal.inc();
                wishlistLogger.info({ userId, productId, categoryId: product.categoryId }, 'wishlist_item_added');
            } catch (error: any) {
                // P2002 race: concurrent add — item already exists, treat as idempotent success
                if (!(error?.code === 'P2002' || String(error?.message ?? '').includes('Unique constraint'))) {
                    throw error;
                }
            }
        }

        return { message: 'Added to wishlist', added: true, productId };
    }

    /**
     * Explicitly remove a product from the wishlist (idempotent).
     */
    async removeItem(userId: string, productId: string): Promise<WishlistToggleResponse> {
        const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
        if (!wishlist) {
            return { message: 'Removed from wishlist', added: false, productId };
        }

        const existing = await prisma.wishlistItem.findUnique({
            where: {
                wishlistId_productId: {
                    wishlistId: wishlist.id,
                    productId,
                },
            },
        });

        if (existing) {
            await prisma.wishlistItem.delete({ where: { id: existing.id } });
            await invalidateCache(CACHE_KEYS.USER_WISHLIST(userId), CACHE_KEYS.USER_WISHLIST_COUNT(userId));
            wishlistRemoveTotal.inc();
            wishlistLogger.info({ userId: wishlist.userId, productId }, 'wishlist_item_removed');
        }

        return { message: 'Removed from wishlist', added: false, productId };
    }

    /**
     * Get total wishlist item count.
     */
    async getCount(userId: string): Promise<WishlistCountResponse> {
        const cacheKey = CACHE_KEYS.USER_WISHLIST_COUNT(userId);
        const cached = await getFromCache<WishlistCountResponse>(cacheKey);
        if (cached) return cached;

        const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
        if (!wishlist) return { count: 0 };

        const count = await prisma.wishlistItem.count({
            where: { wishlistId: wishlist.id },
        });

        const response = { count };
        await setCache(cacheKey, response, WISHLIST_CACHE_TTL_SECONDS);
        return response;
    }

    /**
     * Check if specific product IDs are in the user's wishlist.
     * Returns a set of product IDs that ARE in the wishlist.
     */
    async checkItems(userId: string, productIds: string[]): Promise<{ wishlisted: string[] }> {
        const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
        if (!wishlist) return { wishlisted: [] };

        const items = await prisma.wishlistItem.findMany({
            where: {
                wishlistId: wishlist.id,
                productId: { in: productIds },
            },
            select: { productId: true },
        });

        return { wishlisted: items.map((i) => i.productId) };
    }
}

export const wishlistService = new WishlistService();
