// Order Domain Types
// Import Prisma-generated enum types directly (Prisma v4 exports enums by name)
import type { OrderStatus as PrismaOrderStatus, InventoryMovementType as PrismaInventoryMovementType, InventoryMovementReason as PrismaInventoryMovementReason, Prisma } from '@prisma/client';

// Re-export enum types for convenience
export type OrderStatus = PrismaOrderStatus;
export type InventoryMovementType = PrismaInventoryMovementType;
export type InventoryMovementReason = PrismaInventoryMovementReason;

// ============================================================================
// ENTITY TYPES
// ============================================================================

/**
 * Order entity as returned from database
 */
export interface OrderEntity {
    id: string;
    userId: string;
    status: OrderStatus;
    totalAmount: number;
    subTotalAmount: number;
    totalTaxAmount: number;
    grandTotal: number;
    couponCode?: string | null;
    discountAmount?: Prisma.Decimal | number;
    invoiceNumber?: string | null;
    invoiceIssuedAt?: Date | null;
    shippingName?: string | null;
    shippingPhone?: string | null;
    shippingEmail?: string | null;
    shippingAddressLine1?: string | null;
    shippingAddressLine2?: string | null;
    shippingCity?: string | null;
    shippingPincode?: string | null;
    shippingNotes?: string | null;
    createdAt: Date;
}

/**
 * OrderItem entity as returned from database
 */
export interface OrderItemEntity {
    id: string;
    orderId: string;
    sellerId: string;
    productId: string;
    variantId: string;
    quantity: number;
    priceSnapshot: number;
    sellerPriceSnapshot: number;
    adminPriceSnapshot: number;
    platformMargin: number;
    taxRate: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalAmount: number;
}

/**
 * InventoryMovement entity as returned from database
 */
export interface InventoryMovementEntity {
    id: string;
    variantId: string;
    orderId: string;
    quantity: number;
    type: InventoryMovementType;
    createdAt: Date;
}

// ============================================================================
// COMPOSITE TYPES
// ============================================================================

/**
 * Order with items included
 */
export interface OrderWithItems extends OrderEntity {
    items: OrderItemEntity[];
    cancellationRequest?: {
        id: string;
        status: string;
    } | null;
    paymentStatus?: string | null;
    cancellationStatus?: string | null;
    returnStatus?: string | null;
    shipmentStatus?: string | null;
}

/**
 * Order with items and movements (full detail)
 */
export interface OrderWithDetails extends OrderEntity {
    items: OrderItemWithProduct[];
    movements?: InventoryMovementEntity[];
    paymentStatus?: string | null;
    cancellationStatus?: string | null;
    returnStatus?: string | null;
    shipmentStatus?: string | null;
}

/**
 * Order item with product details for display
 */
export interface OrderItemWithProduct extends OrderItemEntity {
    productTitle?: string;
    variantSku?: string;
}

/**
 * Seller's view of order items
 */
export interface SellerOrderItem extends OrderItemEntity {
    order: {
        id: string;
        status: OrderStatus;
        createdAt: Date;
        cancellationRequest?: {
            id: string;
            status: string;
            reason: string;
            createdAt: Date;
        } | null;
        shipmentStatus?: string | null;
        shippingName?: string | null;
        shippingPhone?: string | null;
        shippingEmail?: string | null;
        shippingAddressLine1?: string | null;
        shippingAddressLine2?: string | null;
        shippingCity?: string | null;
        shippingPincode?: string | null;
        shippingNotes?: string | null;
    };
    productTitle: string | undefined;
    variantSku: string | undefined;
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Create order request (internal use)
 */
export interface CreateOrderRequest {
    userId: string;
    totalAmount: number;
    shippingName?: string | null;
    shippingPhone?: string | null;
    shippingEmail?: string | null;
    shippingAddressLine1?: string | null;
    shippingAddressLine2?: string | null;
    shippingCity?: string | null;
    shippingPincode?: string | null;
    shippingNotes?: string | null;
    items: CreateOrderItemRequest[];
}

/**
 * Create order item request (internal use)
 */
export interface CreateOrderItemRequest {
    sellerId: string;
    productId: string;
    variantId: string;
    quantity: number;
    priceSnapshot: number;
    sellerPriceSnapshot: number;
    adminPriceSnapshot: number;
    platformMargin: number;
}

/**
 * Create inventory movement request
 */
export interface CreateInventoryMovementRequest {
    variantId: string;
    orderId: string;
    quantity: number;
    type: InventoryMovementType;
    reason?: InventoryMovementReason;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Order list response (buyer)
 */
export interface BuyerOrderListResponse {
    orders: OrderWithItems[];
}

/**
 * Order detail response (buyer)
 */
export interface BuyerOrderDetailResponse {
    order: OrderWithDetails;
}

/**
 * Checkout response
 */
export interface CheckoutResponse {
    message: string;
    order: OrderEntity;
}

/**
 * Seller order list response
 */
export interface SellerOrderListResponse {
    orderItems: SellerOrderItem[];
}

/**
 * Seller order detail response
 */
export interface SellerOrderDetailResponse {
    orderId: string;
    status: OrderStatus;
    createdAt: Date;
    items: OrderItemWithProduct[];
}

// Export dummy to ensure module
export const _orderTypesModule = true;
