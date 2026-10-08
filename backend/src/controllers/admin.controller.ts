/**
 * Admin Controller
 * HTTP handlers for admin panel endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service.js';
import { categoryService } from '../services/category.service.js';
import { reviewService } from '../services/review.service.js';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validation.js';
import { auditService } from '../services/audit.service.js';
import type { AuditLogFilters, AuditEntityType } from '../repositories/audit.repository.js';
import { ApiError } from '../errors/ApiError.js';
import { bestsellerService } from '../services/bestseller.service.js';
import { createBestsellerSchema, updateBestsellerSchema } from '../validators/bestseller.validation.js';
import {
    productIdParamSchema,
    productRejectSchema,
    productSetPriceSchema,
    adminProductUpdateSchema,
} from '../validators/admin.validation.js';
import { refundService } from '../services/refund.service.js';
import { commissionService } from '../services/commission.service.js';
import { settingsService, DEFAULT_SHIPPING_FEE_INR, FLAT_GST_FEE_INR } from '../services/settings.service.js';
import type { RefundStatus, SettlementStatus } from '@prisma/client';

function parsePositiveInt(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.trunc(n);
}

function parseDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseAudienceQuery(value: unknown): 'MENS' | 'KIDS' | undefined {
    if (typeof value !== 'string') return undefined;
    const v = value.trim().toUpperCase();
    if (v === 'MENS' || v === 'KIDS') return v;
    return undefined;
}

/**
 * Admin Controller
 * Handles HTTP requests for admin panel
 */
export const adminController = {
    // =========================================================================
    // DASHBOARD STATS
    // =========================================================================

    /**
     * GET /v1/admin/stats
     * Lightweight counts + recent items for admin dashboard
     */
    getStats: async (
        _req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = await adminService.getStats();
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // SELLER MANAGEMENT
    // =========================================================================

    /**
     * GET /v1/admin/sellers
     * List all sellers
     */
    listSellers: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const page = parsePositiveInt(req.query['page'], 1);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const result = await adminService.listSellers({ page, limit });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/sellers/:id/approve
     * Approve a pending seller
     */
    approveSeller: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const actorId = req.user!.userId as string;
            const result = await adminService.approveSeller(id, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/sellers/:id/suspend
     * Suspend a seller
     */
    suspendSeller: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const actorId = req.user!.userId as string;
            const result = await adminService.suspendSeller(id, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // PRODUCT MODERATION
    // =========================================================================

    /**
     * GET /v1/admin/products/pending
     * List products pending moderation
     */
    listPendingProducts: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const page = parsePositiveInt(req.query['page'], 1);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const audience = parseAudienceQuery(req.query['audience']);
            const result = await adminService.listPendingProducts({ page, limit, ...(audience ? { audience } : {}) });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /v1/admin/products
     * List all products
     */
    listAllProducts: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const page = parsePositiveInt(req.query['page'], 1);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const audience = parseAudienceQuery(req.query['audience']);
            const result = await adminService.listAllProducts({ page, limit, ...(audience ? { audience } : {}) });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/products/:id/approve
     * Approve a product
     */
    approveProduct: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { id } = productIdParamSchema.parse(req.params);
            const actorId = req.user!.userId as string;
            const result = await adminService.approveProduct(id, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/products/:id/reject
     * Reject a product
     */
    rejectProduct: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { id } = productIdParamSchema.parse(req.params);
            const { reason } = productRejectSchema.parse(req.body);
            const actorId = req.user!.userId as string;
            const result = await adminService.rejectProduct(id, reason, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /v1/admin/products/:id/set-price
     * Set admin listing price for a product
     */
    setProductPrice: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { id } = productIdParamSchema.parse(req.params);
            const { adminListingPrice } = productSetPriceSchema.parse(req.body);
            const actorId = req.user!.userId as string;
            const result = await adminService.setProductPrice(id, adminListingPrice, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /v1/admin/products/:id
     * Update product metadata (category, description, images, variants) as admin
     */
    updateProduct: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { id } = productIdParamSchema.parse(req.params);
            const payload = adminProductUpdateSchema.parse(req.body);
            const actorId = req.user!.userId as string;
            const result = await adminService.updateProductDetails(id, actorId, payload);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /v1/admin/products/pricing-overview
     */
    pricingOverview: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const page = parsePositiveInt(req.query['page'], 1);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const result = await adminService.pricingOverview({ page, limit });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /v1/admin/analytics/profit
     */
    profitAnalytics: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const startDate = parseDate(req.query['startDate']);
            const endDate = parseDate(req.query['endDate']);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const result = await adminService.profitAnalytics({
                limit,
                ...(startDate ? { startDate } : {}),
                ...(endDate ? { endDate } : {}),
            });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /v1/admin/products/:id
     * Delete a product (soft delete)
     */
    deleteProduct: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const actorId = req.user!.userId as string;
            const reason = req.body?.reason as string | undefined;
            const result = await adminService.deleteProduct(id, actorId, reason);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // CATEGORY MANAGEMENT
    // =========================================================================

    /**
     * GET /v1/admin/categories
     * List all categories (active + inactive)
     */
    listCategories: async (
        _req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = await categoryService.listAllCategories();
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /v1/admin/categories
     * Create category
     */
    createCategory: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validated = createCategorySchema.parse(req.body);
            const category = await categoryService.createCategory(validated);
            res.status(201).json({ message: 'Category created', category });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/categories/:id
     * Update category
     */
    updateCategory: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const validated = updateCategorySchema.parse(req.body);
            const category = await categoryService.updateCategory(id, validated);
            res.json({ message: 'Category updated', category });
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /v1/admin/categories/:id
     * Delete category (fails if products exist)
     */
    deleteCategory: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            await categoryService.deleteCategory(id);
            res.json({ message: 'Category deleted' });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /v1/admin/categories/:id/toggle
     * Toggle category active state
     */
    toggleCategory: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const category = await categoryService.toggleCategory(id);
            const action = category.isActive ? 'activated' : 'deactivated';
            res.json({ message: `Category ${action}`, category });
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // REVIEW MANAGEMENT
    // =========================================================================

    /**
     * GET /v1/admin/reviews
     * List all reviews
     */
    listReviews: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const rawPage = Number(req.query['page'] ?? 1);
            const rawLimit = Number(req.query['limit'] ?? 50);
            const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1;
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(100, Math.trunc(rawLimit)) : 50;

            const result = await reviewService.listReviews({ page, limit });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /v1/admin/reviews/:id
     * Delete review
     */
    deleteReview: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            await reviewService.deleteReview(id);
            res.json({ message: 'Review deleted' });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /v1/admin/reviews/:id/hide
     * Hide/unhide a review
     */
    hideReview: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const { isHidden } = req.body as { isHidden: boolean };
            if (typeof isHidden !== 'boolean') {
                throw ApiError.badRequest('isHidden must be a boolean');
            }
            const review = await reviewService.setHidden(id, isHidden);
            const action = isHidden ? 'hidden' : 'unhidden';
            res.json({ message: `Review ${action}`, review });
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // BESTSELLER MANAGEMENT
    // =========================================================================

    /**
     * GET /v1/admin/bestsellers
     */
    listBestsellers: async (
        _req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = await bestsellerService.listAdmin();
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /v1/admin/bestsellers
     */
    createBestseller: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validated = createBestsellerSchema.parse(req.body);
            const created = await bestsellerService.add(validated.productId, validated.position);
            res.status(201).json({ message: 'Bestseller added', bestseller: created });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/bestsellers/:id
     */
    updateBestseller: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const validated = updateBestsellerSchema.parse(req.body);
            const updated = await bestsellerService.update(id, validated.position);
            res.json({ message: 'Bestseller updated', bestseller: updated });
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /v1/admin/bestsellers/:id
     */
    deleteBestseller: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            await bestsellerService.remove(id);
            res.json({ message: 'Bestseller removed' });
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // ORDER MANAGEMENT
    // =========================================================================

    /**
     * GET /v1/admin/orders
     * List all orders
     */
    listOrders: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const page = parsePositiveInt(req.query['page'], 1);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const startDate = parseDate(req.query['startDate']);
            const endDate = parseDate(req.query['endDate']);
            const result = await adminService.listOrders({
                page,
                limit,
                ...(startDate ? { startDate } : {}),
                ...(endDate ? { endDate } : {}),
            });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/orders/:id/cancel
     * Cancel an order
     */
    cancelOrder: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const actorId = req.user!.userId as string;
            const result = await adminService.cancelOrder(id, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/orders/:id/force-confirm
     * Force confirm an order (SUPER_ADMIN only)
     */
    forceConfirmOrder: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const actorId = req.user!.userId as string;
            const result = await adminService.forceConfirmOrder(id, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // PAYMENTS & SETTLEMENTS
    // =========================================================================

    /**
     * GET /v1/admin/payments
     * List all payments
     */
    listPayments: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const page = parsePositiveInt(req.query['page'], 1);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const result = await adminService.listPayments({ page, limit });
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /v1/admin/settlements
     * List all settlements with optional filters
     */
    listSettlements: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { sellerId, orderId, status } = req.query;
            const filters: { sellerId?: string; orderId?: string; status?: SettlementStatus } = {};
            if (typeof sellerId === 'string') filters.sellerId = sellerId;
            if (typeof orderId === 'string') filters.orderId = orderId;
            if (typeof status === 'string') filters.status = status as SettlementStatus;
            const result = await commissionService.listSettlements(filters);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // AUDIT LOGS
    // =========================================================================

    /**
     * GET /v1/admin/audit-logs
     * List audit logs with optional filters
     */
    listAuditLogs: async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { entityType, entityId, actorId, startDate, endDate } = req.query;

            const filters: AuditLogFilters = {};

            if (entityType && typeof entityType === 'string') {
                filters.entityType = entityType as AuditEntityType;
            }
            if (entityId && typeof entityId === 'string') {
                filters.entityId = entityId;
            }
            if (actorId && typeof actorId === 'string') {
                filters.actorId = actorId;
            }
            if (startDate && typeof startDate === 'string') {
                filters.startDate = new Date(startDate);
            }
            if (endDate && typeof endDate === 'string') {
                filters.endDate = new Date(endDate);
            }

            const result = await auditService.getAuditLogs(filters);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // REFUND LEDGER
    // =========================================================================

    /**
     * GET /v1/admin/refunds
     * List all refund ledger entries with optional filters
     */
    async listRefunds(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId, status } = req.query;
            const filters: { orderId?: string; status?: RefundStatus } = {};
            if (typeof orderId === 'string') filters.orderId = orderId;
            if (typeof status === 'string') filters.status = status as RefundStatus;
            const result = await refundService.listRefunds(filters);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    // =========================================================================
    // PLATFORM SETTINGS
    // =========================================================================

    /**
     * GET /v1/admin/settings/shipping
     * Current shipping-charge configuration.
     */
    async getShippingSetting(_req: Request, res: Response, next: NextFunction) {
        try {
            const enabled = await settingsService.isShippingChargeEnabled();
            res.json({ enabled, amount: DEFAULT_SHIPPING_FEE_INR });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/settings/shipping
     * Start/stop the flat shipping charge for new orders.
     * Body: { enabled: boolean }
     */
    async updateShippingSetting(req: Request, res: Response, next: NextFunction) {
        try {
            const { enabled } = req.body ?? {};
            if (typeof enabled !== 'boolean') {
                throw ApiError.badRequest('`enabled` must be a boolean');
            }
            await settingsService.setShippingChargeEnabled(enabled);
            res.json({ enabled, amount: DEFAULT_SHIPPING_FEE_INR });
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /v1/admin/settings/gst
     * Current flat-GST-charge configuration.
     */
    async getGstSetting(_req: Request, res: Response, next: NextFunction) {
        try {
            const enabled = await settingsService.isGstChargeEnabled();
            res.json({ enabled, amount: FLAT_GST_FEE_INR });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/settings/gst
     * Start/stop the flat GST charge for new orders.
     * Body: { enabled: boolean }
     */
    async updateGstSetting(req: Request, res: Response, next: NextFunction) {
        try {
            const { enabled } = req.body ?? {};
            if (typeof enabled !== 'boolean') {
                throw ApiError.badRequest('`enabled` must be a boolean');
            }
            await settingsService.setGstChargeEnabled(enabled);
            res.json({ enabled, amount: FLAT_GST_FEE_INR });
        } catch (error) {
            next(error);
        }
    },
};
