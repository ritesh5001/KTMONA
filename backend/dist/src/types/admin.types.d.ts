/**
 * Admin Types
 * DTOs for admin panel operations
 */
import type { UserStatus, Role, OrderStatus, PaymentStatus, SettlementStatus, ProductModerationStatus, AuditEntity } from '@prisma/client';
export interface AdminSellerEntity {
    id: string;
    email: string | null;
    phone: string | null;
    role: Role;
    status: UserStatus;
    createdAt: Date;
}
export interface AdminSellerListResponse {
    sellers: AdminSellerEntity[];
}
export interface AdminSellerActionResponse {
    message: string;
    seller: AdminSellerEntity;
}
export interface AdminProductEntity {
    id: string;
    title: string;
    sellerId: string;
    categoryId: string;
    isPublished: boolean;
    createdAt: Date;
    moderation: {
        status: ProductModerationStatus;
        reason: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
    } | null;
}
export interface AdminProductListResponse {
    products: AdminProductEntity[];
}
export interface AdminProductActionResponse {
    message: string;
    product: AdminProductEntity;
}
export interface ProductModerationInput {
    reason?: string;
}
export interface AdminOrderEntity {
    id: string;
    userId: string;
    buyerEmail?: string | null;
    buyerPhone?: string | null;
    status: OrderStatus;
    totalAmount: number;
    shippingName?: string | null;
    shippingPhone?: string | null;
    shippingEmail?: string | null;
    shippingAddressLine1?: string | null;
    shippingAddressLine2?: string | null;
    shippingCity?: string | null;
    shippingPincode?: string | null;
    shippingNotes?: string | null;
    createdAt: Date;
    items: {
        id: string;
        sellerId: string;
        sellerEmail?: string | null;
        sellerName?: string | null;
        productId: string;
        productTitle?: string | null;
        variantId: string;
        variantSku?: string | null;
        quantity: number;
        priceSnapshot: number;
        sellerPriceSnapshot?: number;
        adminPriceSnapshot?: number;
        platformMargin?: number;
    }[];
}
export interface AdminOrderListResponse {
    orders: AdminOrderEntity[];
}
export interface AdminOrderActionResponse {
    message: string;
    order: AdminOrderEntity;
}
export interface AdminPaymentEntity {
    id: string;
    orderId: string;
    userId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    provider: string;
    providerPaymentId: string | null;
    createdAt: Date;
}
export interface AdminPaymentListResponse {
    payments: AdminPaymentEntity[];
}
export interface AdminSettlementEntity {
    id: string;
    orderId: string;
    sellerId: string;
    grossAmount: number;
    commissionAmount: number;
    platformFee: number;
    netAmount: number;
    status: SettlementStatus;
    settledAt: Date | null;
    createdAt: Date;
}
export interface AdminSettlementListResponse {
    settlements: AdminSettlementEntity[];
}
export interface AuditLogEntity {
    id: string;
    actorId: string;
    action: string;
    entityType: AuditEntity;
    entityId: string;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
}
export interface AuditLogListResponse {
    auditLogs: AuditLogEntity[];
}
export interface AuditLogFilters {
    entityType?: AuditEntity;
    entityId?: string;
    actorId?: string;
    startDate?: Date;
    endDate?: Date;
}
export interface CreateAuditLogInput {
    actorId: string;
    action: string;
    entityType: AuditEntity;
    entityId: string;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=admin.types.d.ts.map