import { cartRepository } from '../repositories/cart.repository.js';
import { variantRepository } from '../repositories/variant.repository.js';
import { invalidateCache, CACHE_KEYS, } from '../utils/cache.util.js';
import { ApiError } from '../errors/ApiError.js';
/**
 * Cart Service
 * Business logic for shopping cart operations
 */
export class CartService {
    cartRepo;
    variantRepo;
    constructor(cartRepo, variantRepo) {
        this.cartRepo = cartRepo;
        this.variantRepo = variantRepo;
    }
    /**
     * Get user's cart with items
     * Uses Redis caching
     */
    async getCart(userId) {
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
    async addItem(userId, data) {
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
            throw ApiError.badRequest(`Insufficient stock. Available: ${availableStock}, Requested: ${data.quantity}`);
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
    async updateItem(userId, itemId, quantity) {
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
            throw ApiError.badRequest(`Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
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
    /**
     * Remove item from cart
     */
    async removeItem(userId, itemId) {
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
export const cartService = new CartService(cartRepository, variantRepository);
//# sourceMappingURL=cart.service.js.map