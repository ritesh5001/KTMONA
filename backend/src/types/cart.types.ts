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
    /** "Save for later" rows stay with the cart but are not checked out. */
    savedForLater: boolean;
    createdAt: Date;
}

/** Another size/colour of the same product, for changing it in the cart. */
export interface CartVariantOption {
    id: string;
    size: string;
    color: string | null;
    colorHex: string | null;
    price: number;
    stock: number;
}

/** Live state of a cart line, so the cart can warn before checkout does. */
export interface CartItemAvailability {
    /** UNAVAILABLE = listing removed, paused or not approved. */
    status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNAVAILABLE';
    stock: number;
    /** Largest quantity the buyer can order right now. */
    maxQuantity: number;
    /** Current price minus the price when the item was added (0 = unchanged). */
    priceChange: number;
    /** True when the cart quantity is above what is in stock. */
    quantityTooHigh: boolean;
}

// ============================================================================
// COMPOSITE TYPES
// ============================================================================

/**
 * Cart with items included
 */
export interface CartWithItems extends CartEntity {
    /** Lines going to checkout. */
    items: CartItemWithDetails[];
    /** Lines the buyer saved for later. */
    savedItems: CartItemWithDetails[];
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
    availability: CartItemAvailability;
    /** Other in-stock sizes/colours of this product. */
    options: CartVariantOption[];
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