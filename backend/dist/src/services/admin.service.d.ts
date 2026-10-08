/**
 * Admin Service
 * Business logic for admin panel operations
 */
import { AdminRepository, AdminSeller, AdminProduct, AdminOrder, AdminPayment, AdminSettlement, AdminPricingOverviewItem, AdminProfitAnalytics } from '../repositories/admin.repository.js';
import { AuditService } from './audit.service.js';
import type { AdminProductUpdateInput } from '../validators/admin.validation.js';
/**
 * Admin Service Class
 * Handles all admin panel business logic with audit logging
 */
export declare class AdminService {
    private readonly adminRepo;
    private readonly auditSvc;
    constructor(adminRepo: AdminRepository, auditSvc: AuditService);
    /**
     * Lightweight counts for the admin dashboard.
     * Uses COUNT queries instead of fetching entire collections.
     */
    getStats(): Promise<{
        stats: {
            sellers: number;
            products: number;
            orders: number;
            payments: number;
        };
        recentSellers: AdminSeller[];
        recentProducts: AdminProduct[];
    }>;
    /**
     * List all sellers
     */
    listSellers(params?: {
        page?: number;
        limit?: number;
    }): Promise<{
        sellers: AdminSeller[];
    }>;
    /**
     * Approve a pending seller
     */
    approveSeller(sellerId: string, actorId: string): Promise<{
        message: string;
        seller: AdminSeller;
    }>;
    /**
     * Suspend a seller
     */
    suspendSeller(sellerId: string, actorId: string): Promise<{
        message: string;
        seller: AdminSeller;
    }>;
    /**
     * List products pending moderation
     */
    listPendingProducts(params?: {
        page?: number;
        limit?: number;
        audience?: 'MENS' | 'KIDS';
    }): Promise<{
        products: AdminProduct[];
    }>;
    /**
     * List all products (admin table view)
     */
    /**
     * Admin product list.
     *
     * Cached because this is the slowest screen in the dashboard: Prisma expands the
     * seller / seller_profiles / category / occasions / variants / inventory includes
     * into seven separate statements, and against a cross-region database that cost
     * seconds on EVERY view — including simply navigating back to the list.
     *
     * The key deliberately sits under the `products:list:` prefix, which
     * invalidateProductCaches() already wipes. Every admin mutation (approve, reject,
     * delete, price update) calls it, so an admin still sees their own change
     * immediately rather than a stale row.
     */
    listAllProducts(params?: {
        page?: number;
        limit?: number;
        audience?: 'MENS' | 'KIDS';
    }): Promise<{
        products: AdminProduct[];
    }>;
    /**
     * Approve a product
     */
    approveProduct(productId: string, actorId: string): Promise<{
        message: string;
        product: AdminProduct;
    }>;
    /**
     * Reject a product
     */
    rejectProduct(productId: string, reason: string, actorId: string): Promise<{
        message: string;
        product: AdminProduct;
    }>;
    /**
     * Delete product by admin (soft delete)
     */
    deleteProduct(productId: string, actorId: string, reason?: string): Promise<{
        message: string;
        product: AdminProduct;
    }>;
    setProductPrice(productId: string, adminListingPrice: number, actorId: string): Promise<{
        sellerPrice: number;
        adminListingPrice: number;
        margin: number;
        marginPercentage: number;
    }>;
    updateProductDetails(productId: string, actorId: string, payload: AdminProductUpdateInput): Promise<{
        message: string;
        product: AdminProduct;
    }>;
    pricingOverview(params?: {
        page?: number;
        limit?: number;
    }): Promise<{
        products: AdminPricingOverviewItem[];
    }>;
    profitAnalytics(params?: {
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<AdminProfitAnalytics>;
    /**
     * List all orders (with caching)
     */
    listOrders(params?: {
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        orders: AdminOrder[];
    }>;
    /**
     * Cancel an order (ADMIN can cancel non-delivered orders)
     */
    cancelOrder(orderId: string, actorId: string): Promise<{
        message: string;
        order: AdminOrder;
    }>;
    /**
     * Force confirm an order (SUPER_ADMIN only - bypasses payment)
     */
    forceConfirmOrder(orderId: string, actorId: string): Promise<{
        message: string;
        order: AdminOrder;
    }>;
    /**
     * List all payments (with caching)
     */
    listPayments(params?: {
        page?: number;
        limit?: number;
    }): Promise<{
        payments: AdminPayment[];
    }>;
    /**
     * List all settlements
     */
    listSettlements(params?: {
        page?: number;
        limit?: number;
    }): Promise<{
        settlements: AdminSettlement[];
    }>;
}
export declare const adminService: AdminService;
//# sourceMappingURL=admin.service.d.ts.map