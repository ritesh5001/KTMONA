// Cart Domain Types

// ============================================================================
// ENTITY TYPES
// ============================================================================

/**
 * Cart entity as returned from database
 */
export interface CartEntity {
    id: string;
    userId: string;
    updatedAt: Date;
}

/**
 * CartItem entity as returned from database
 */
export interface CartItemEntity {
    id: string;
    cartId: string;
    productId: string;
    variantId: string;
    quantity: number;
    priceSnapshot: number;
    createdAt: Date;
}

// ============================================================================
// COMPOSITE TYPES
// ============================================================================

/**
 * Cart with items included
 */
export interface CartWithItems extends CartEntity {
    items: CartItemWithDetails[];
}

/**
 * Cart item with product and variant details for display
 */
export interface CartItemWithDetails extends CartItemEntity {
    product: {
        id: string;
        title: string;
        sellerId: string;
        /** First image is the cart thumbnail. */
        images?: string[];
    } | undefined;
    variant: {
        id: string;
        size: string;
        sku: string;
        color?: string | null;
        colorHex?: string | null;
        /** Colour-specific gallery; preferred over the product images in the cart. */
        images?: string[];
        price: number;
        compareAtPrice?: number | null;
        inventory: {
            stock: number;
        } | null;
    } | undefined;
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Add item to cart request
 */
export interface AddCartItemRequest {
    productId: string;
    variantId: string;
    quantity: number;
}

/**
 * Update cart item request
 */
export interface UpdateCartItemRequest {
    quantity: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Cart response
 */
export interface CartResponse {
    cart: CartWithItems;
}

/**
 * Cart item mutation response
 */
export interface CartItemResponse {
    message: string;
    item: CartItemEntity;
}

/**
 * Cart item delete response
 */
export interface CartItemDeleteResponse {
    message: string;
}

// Export dummy to ensure module
export const _cartTypesModule = true;