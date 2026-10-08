/**
 * Admin Repository
 * Database operations for admin panel
 */
interface PaginationParams {
    page?: number;
    limit?: number;
}
interface DateRangeParams {
    startDate?: Date;
    endDate?: Date;
}
export type ProductModerationStatusType = 'PENDING' | 'APPROVED' | 'REJECTED';
export type UserStatusType = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type OrderStatusType = 'PLACED' | 'CONFIRMED' | 'CANCELLED' | 'SHIPPED' | 'DELIVERED';
export interface AdminSeller {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
    createdAt: Date;
}
export interface AdminProduct {
    id: string;
    title: string;
    description?: string | null;
    images?: string[];
    sellerId: string;
    sellerName?: string | null;
    sellerPhone?: string | null;
    sellerEmail: string | null;
    categoryId: string;
    categoryName: string | null;
    audience: 'MENS' | 'KIDS';
    sellerPrice?: number;
    adminListingPrice?: number | null;
    priceApprovedAt?: Date | null;
    priceApprovedById?: string | null;
    status: ProductModerationStatusType;
    rejectionReason?: string | null;
    approvedAt?: Date | null;
    approvedById?: string | null;
    variants?: Array<{
        id: string;
        size: string;
        color: string | null;
        colorHex: string | null;
        images: string[];
        sku: string;
        sellerPrice: number;
        adminListingPrice: number | null;
        price: number;
        compareAtPrice: number | null;
        status: ProductModerationStatusType;
        rejectionReason?: string | null;
        approvedAt?: Date | null;
        stock: number;
    }>;
    isPublished: boolean;
    deletedByAdmin: boolean;
    deletedByAdminAt: Date | null;
    deletedByAdminReason: string | null;
    createdAt: Date;
    moderation: {
        status: string;
        reason: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
    } | null;
    occasionIds?: string[];
}
export interface AdminOrder {
    id: string;
    userId: string;
    buyerEmail?: string | null;
    buyerPhone?: string | null;
    status: string;
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
export interface AdminPricingOverviewItem {
    productId: string;
    title: string;
    sellerId: string;
    sellerName: string | null;
    sellerEmail: string | null;
    sellerPrice: number;
    adminListingPrice: number | null;
    margin: number | null;
    marginPercentage: number | null;
    status: ProductModerationStatusType;
    image: string | null;
    updatedAt: Date;
}
export interface AdminProfitAnalytics {
    totalPlatformRevenue: number;
    totalSellerPayout: number;
    totalMarginEarned: number;
    profitPerProduct: Array<{
        productId: string;
        title: string;
        margin: number;
        soldUnits: number;
    }>;
    profitPerSeller: Array<{
        sellerId: string;
        sellerEmail: string | null;
        sellerName: string | null;
        margin: number;
        soldUnits: number;
    }>;
}
export interface AdminPayment {
    id: string;
    orderId: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    provider: string;
    providerPaymentId: string | null;
    createdAt: Date;
}
export interface AdminSettlement {
    id: string;
    orderId: string;
    sellerId: string;
    grossAmount: number;
    commissionAmount: number;
    platformFee: number;
    netAmount: number;
    status: string;
    settledAt: Date | null;
    createdAt: Date;
}
/**
 * Admin Repository Class
 * Handles all admin-related database queries
 */
export declare class AdminRepository {
    /**
     * Get aggregate counts for admin dashboard — uses COUNT instead of fetching all rows.
     */
    getStats(): Promise<{
        sellers: number;
        products: number;
        orders: number;
        payments: number;
    }>;
    /**
     * Get recent sellers (last 5)
     */
    findRecentSellers(limit?: number): Promise<AdminSeller[]>;
    /**
     * Get recent products (last 5)
     */
    findRecentProducts(limit?: number): Promise<AdminProduct[]>;
    /**
     * Find all sellers
     */
    findAllSellers(params?: PaginationParams): Promise<AdminSeller[]>;
    /**
     * Find seller by ID
     */
    findSellerById(id: string): Promise<AdminSeller | null>;
    /**
     * Update seller status
     */
    updateSellerStatus(id: string, status: UserStatusType): Promise<AdminSeller>;
    /**
     * Find all products pending moderation
     */
    findPendingProducts(params?: PaginationParams & {
        audience?: 'MENS' | 'KIDS';
    }): Promise<AdminProduct[]>;
    /**
     * Find product by ID with moderation info
     */
    findProductById(id: string): Promise<AdminProduct | null>;
    /**
     * List all products for admin view
     */
    /**
     * Given raw product rows (already joined with seller + category), attach their
     * variants/inventory and occasions with two further statements and reshape into
     * the structure the old nested-include query produced.
     *
     * Shared by findAllProducts and findProductById so a single-product read costs
     * three round-trips instead of seven. findProductById runs twice on every admin
     * product save, so on its own it accounted for fourteen statements.
     */
    private hydrateAdminProductRows;
    findAllProducts(params?: PaginationParams & {
        audience?: 'MENS' | 'KIDS';
    }): Promise<AdminProduct[]>;
    /**
     * Soft-delete a product by admin
     */
    markProductDeletedByAdmin(id: string, reason?: string): Promise<AdminProduct>;
    /**
     * Update product moderation status
     */
    updateProductModeration(productId: string, status: ProductModerationStatusType, reviewedBy: string, reason?: string): Promise<void>;
    /**
     * Update product publish status
     */
    updateProductPublishStatus(id: string, isPublished: boolean): Promise<AdminProduct>;
    applyProductApprovalDecision(productId: string, actorId: string, decision: 'APPROVED' | 'REJECTED', reason?: string): Promise<AdminProduct>;
    setProductListingPrice(productId: string, adminListingPrice: number, actorId: string): Promise<AdminProduct>;
    findProductPricingOverview(params?: PaginationParams): Promise<AdminPricingOverviewItem[]>;
    getProfitAnalytics(params?: DateRangeParams & {
        limit?: number;
    }): Promise<AdminProfitAnalytics>;
    /**
     * Find all orders
     */
    findAllOrders(params?: PaginationParams & DateRangeParams): Promise<AdminOrder[]>;
    /**
     * Find order by ID
     */
    findOrderById(id: string): Promise<AdminOrder | null>;
    /**
     * Update order status
     */
    updateOrderStatus(id: string, status: OrderStatusType): Promise<AdminOrder>;
    private enrichOrders;
    /**
     * Find all payments
     */
    findAllPayments(params?: PaginationParams): Promise<AdminPayment[]>;
    /**
     * Find all settlements
     */
    findAllSettlements(params?: PaginationParams): Promise<AdminSettlement[]>;
}
export declare const adminRepository: AdminRepository;
export {};
//# sourceMappingURL=admin.repository.d.ts.map