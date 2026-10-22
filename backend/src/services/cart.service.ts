import { CartRepository, cartRepository } from '../repositories/cart.repository.js';
import { VariantRepository, variantRepository } from '../repositories/variant.repository.js';
import {
    invalidateCache,
    CACHE_KEYS,
} from '../utils/cache.util.js';
import { ApiError } from '../errors/ApiError.js';
import type {
    CartResponse,
    CartItemResponse,
    CartItemDeleteResponse,
    AddCartItemRequest,
} from '../types/cart.types.js';

/**
 * Cart Service
 * Business logic for shopping cart operations
 */
export class CartService {
    constructor(
        private readonly cartRepo: CartRepository,
        private readonly variantRepo: VariantRepository
    ) { }

    /**
     * Get user's cart with items
     * Uses Redis caching
     */
    async getCart(userId: string): Promise<CartResponse> {
        // Get cart with details
        const cart = await this.cartRepo.getCartWithDetails(userId);
        if (!cart) {
            throw ApiError.internal('Failed to create cart');
        }

        return { cart };
    }

    /**
     * Add item to cart
     * Validates stock availability and snapshots price
     */
    async addItem(userId: string, data: AddCartItemRequest): Promise<CartItemResponse> {
        // 1. Validate the variant and resolve the cart concurrently — the two lookups
        //    are independent, and running them in series paid two full cross-region
        //    round-trips for no reason.
        const [variant, cart] = await Promise.all([
            this.variantRepo.findByIdWithProduct(data.variantId),
            this.cartRepo.findOrCreateByUserId(userId),
        ]);
        if (!variant) {
            throw ApiError.notFound('Variant not found');
        }

        // 2. Validate product ID matches
        if (variant.productId !== data.productId) {
            throw ApiError.badRequest('Variant does not belong to specified product');
        }

        if (variant.product.deletedByAdmin || variant.product.status !== 'APPROVED' || variant.status !== 'APPROVED') {
            throw ApiError.badRequest('This product is not available for purchase');
        }

        // 3. Check stock availability
        const availableStock = variant.inventory?.stock ?? 0;

        if (data.quantity > availableStock) {
            throw ApiError.badRequest(
                `Insufficient stock. Available: ${availableStock}, Requested: ${data.quantity}`
            );
        }

        // 4. Add/update item with price snapshot (cart was resolved in step 1)
        const item = await this.cartRepo.addItem(cart.id, {
            ...data,
            priceSnapshot: Number(variant.price),
        });

        // 5. Invalidate cache
        await invalidateCache(CACHE_KEYS.CART(userId));

        return {
            message: 'Item added to cart',
            item,
        };
    }

    /**
     * Update cart item quantity
     * Validates stock availability
     */
    async updateItem(
        userId: string,
        itemId: string,
        quantity: number
    ): Promise<CartItemResponse> {
        // 1. Find item with cart for ownership check
        const itemWithCart = await this.cartRepo.findItemByIdWithCart(itemId);
        if (!itemWithCart) {
            throw ApiError.notFound('Cart item not found');
        }

        // 2. Verify ownership
        if (itemWithCart.cart.userId !== userId) {
            throw ApiError.forbidden('You do not have permission to update this item');
        }

        // 3. Check stock availability + pricing in a single variant lookup
        const variantWithProduct = await this.variantRepo.findByIdWithProduct(itemWithCart.variantId);
        if (!variantWithProduct) {
            throw ApiError.notFound('Variant not found');
        }
        const availableStock = variantWithProduct.inventory?.stock ?? 0;

        if (quantity > availableStock) {
            throw ApiError.badRequest(
                `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`
            );
        }

        // 4. Get current price for snapshot update
        if (variantWithProduct.product.deletedByAdmin || variantWithProduct.product.status !== 'APPROVED' || variantWithProduct.status !== 'APPROVED') {
            throw ApiError.badRequest('This product is not available for purchase');
        }

        const currentPrice = variantWithProduct.price ?? itemWithCart.priceSnapshot;

        // 5. Update quantity
        const item = await this.cartRepo.updateItemQuantity(itemId, quantity, currentPrice);

        // 6. Invalidate cache
        await invalidateCache(CACHE_KEYS.CART(userId));

        return {
            message: 'Cart item updated',
            item,
        };
    }

    /** Ownership-checked load of one cart line. */
    private async ownedItem(userId: string, itemId: string) {
        const itemWithCart = await this.cartRepo.findItemByIdWithCart(itemId);
        if (!itemWithCart) {
            throw ApiError.notFound('Cart item not found');
        }
        if (itemWithCart.cart.userId !== userId) {
            throw ApiError.forbidden('You do not have permission to change this item');
        }
        return itemWithCart;
    }

    /**
     * Move a line to "Saved for later" (left out of checkout) or back to the cart.
     */
    async setSavedForLater(userId: string, itemId: string, saved: boolean): Promise<CartItemResponse> {
        await this.ownedItem(userId, itemId);
        const item = await this.cartRepo.setSavedForLater(itemId, saved);
        await invalidateCache(CACHE_KEYS.CART(userId));
        return {
            message: saved ? 'Saved for later' : 'Moved to cart',
            item,
        };
    }

    /**
     * Change a line's size/colour to another variant of the same product.
     */
    async changeVariant(userId: string, itemId: string, variantId: string): Promise<CartItemResponse> {
        const current = await this.ownedItem(userId, itemId);
        if (current.variantId === variantId) {
            return { message: 'Cart item updated', item: current };
        }

        const variant = await this.variantRepo.findByIdWithProduct(variantId);
        if (!variant || variant.productId !== current.productId) {
            throw ApiError.badRequest('That size/colour is not available for this product');
        }
        if (variant.product.deletedByAdmin || variant.product.status !== 'APPROVED' || variant.status !== 'APPROVED') {
            throw ApiError.badRequest('That size/colour is not available for purchase');
        }
        const stock = variant.inventory?.stock ?? 0;
        if (stock <= 0) {
            throw ApiError.badRequest('That size/colour is out of stock');
        }

        const item = await this.cartRepo.changeVariant(current, variantId, Number(variant.price), stock);
        await invalidateCache(CACHE_KEYS.CART(userId));
        return {
            message: 'Cart item updated',
            item,
        };
    }

    /**
     * Add a guest's on-device cart after they sign in. Lines that can no longer be
     * bought are skipped (and reported) rather than failing the whole merge; a
     * product already in the cart keeps the larger quantity.
     */
    async mergeItems(
        userId: string,
        items: AddCartItemRequest[],
    ): Promise<{ added: number; skipped: Array<{ variantId: string; reason: string }> }> {
        const cart = await this.cartRepo.findOrCreateByUserId(userId);
        const existing = await this.cartRepo.findByUserId(userId);
        const existingQty = new Map((existing?.items ?? []).map((i) => [i.variantId, i.quantity]));

        let added = 0;
        const skipped: Array<{ variantId: string; reason: string }> = [];
        for (const line of items) {
            try {
                const variant = await this.variantRepo.findByIdWithProduct(line.variantId);
                if (!variant || variant.productId !== line.productId) {
                    skipped.push({ variantId: line.variantId, reason: 'Product not found' });
                    continue;
                }
                if (variant.product.deletedByAdmin || variant.product.status !== 'APPROVED' || variant.status !== 'APPROVED') {
                    skipped.push({ variantId: line.variantId, reason: 'No longer available' });
                    continue;
                }
                const stock = variant.inventory?.stock ?? 0;
                const quantity = Math.min(Math.max(line.quantity, existingQty.get(line.variantId) ?? 0), stock);
                if (quantity <= 0) {
                    skipped.push({ variantId: line.variantId, reason: 'Out of stock' });
                    continue;
                }
                await this.cartRepo.addItem(cart.id, { ...line, quantity, priceSnapshot: Number(variant.price) });
                added += 1;
            } catch {
                skipped.push({ variantId: line.variantId, reason: 'Could not be added' });
            }
        }

        await invalidateCache(CACHE_KEYS.CART(userId));
        return { added, skipped };
    }

    /**
     * Remove item from cart
     */
    async removeItem(userId: string, itemId: string): Promise<CartItemDeleteResponse> {
        // 1. Find item with cart for ownership check
        const itemWithCart = await this.cartRepo.findItemByIdWithCart(itemId);
        if (!itemWithCart) {
            throw ApiError.notFound('Cart item not found');
        }

        // 2. Verify ownership
        if (itemWithCart.cart.userId !== userId) {
            throw ApiError.forbidden('You do not have permission to remove this item');
        }

        // 3. Remove item
        await this.cartRepo.removeItem(itemId);

        // 4. Invalidate cache
        await invalidateCache(CACHE_KEYS.CART(userId));

        return {
            message: 'Item removed from cart',
        };
    }
}

// Export singleton instance with default repositories
export const cartService = new CartService(
    cartRepository,
    variantRepository
);
