/**
 * Admin Routes
 * Routes for admin panel endpoints with role-based access control
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { adminController } from '../controllers/admin.controller.js';
import { commissionRuleController } from '../controllers/commissionRule.controller.js';
import { couponAdminController } from '../controllers/couponAdmin.controller.js';
import { occasionController } from '../controllers/occasion.controller.js';

export const adminRouter = Router();

// ============================================================================
// All routes require authentication
// ============================================================================
adminRouter.use(authenticate);

// ============================================================================
// DASHBOARD STATS (lightweight counts)
// ============================================================================

/**
 * GET /v1/admin/stats
 * Lightweight dashboard counts + recent items
 */
adminRouter.get(
    '/stats',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.getStats
);

// ============================================================================
// SELLER MANAGEMENT (ADMIN + SUPER_ADMIN)
// ============================================================================

/**
 * GET /v1/admin/sellers
 * List all sellers
 */
adminRouter.get(
    '/sellers',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listSellers
);

/**
 * PUT /v1/admin/sellers/:id/approve
 * Approve a pending seller
 */
adminRouter.put(
    '/sellers/:id/approve',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.approveSeller
);

/**
 * PUT /v1/admin/sellers/:id/suspend
 * Suspend a seller
 */
adminRouter.put(
    '/sellers/:id/suspend',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.suspendSeller
);

/**
 * GET /v1/admin/products
 * List all products
 */
adminRouter.get(
    '/products',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listAllProducts
);

/**
 * GET /v1/admin/products/pending
 * List products pending approval
 */
adminRouter.get(
    '/products/pending',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listPendingProducts
);

adminRouter.get(
    '/products/pricing-overview',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.pricingOverview
);

/**
 * PATCH /v1/admin/products/:id/approve
 * Approve a pending product
 */
adminRouter.patch(
    '/products/:id/approve',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.approveProduct
);

/**
 * PATCH /v1/admin/products/:id/reject
 * Reject a pending product
 */
adminRouter.patch(
    '/products/:id/reject',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.rejectProduct
);

adminRouter.patch(
    '/products/:id/set-price',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.setProductPrice
);

adminRouter.patch(
    '/products/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.updateProduct
);

// Backward-compatible aliases
adminRouter.put(
    '/products/:id/approve',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.approveProduct
);

adminRouter.put(
    '/products/:id/reject',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.rejectProduct
);

adminRouter.put(
    '/products/:id/set-price',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.setProductPrice
);

adminRouter.put(
    '/products/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.updateProduct
);

/**
 * DELETE /v1/admin/products/:id
 * Delete a product (soft delete)
 */
adminRouter.delete(
    '/products/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.deleteProduct
);

// ============================================================================
// CATEGORY MANAGEMENT (ADMIN + SUPER_ADMIN)
// ============================================================================

/**
 * GET /v1/admin/categories
 * List all categories
 */
adminRouter.get(
    '/categories',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listCategories
);

/**
 * POST /v1/admin/categories
 * Create category
 */
adminRouter.post(
    '/categories',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.createCategory
);

/**
 * PUT /v1/admin/categories/:id
 * Update category
 */
adminRouter.put(
    '/categories/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.updateCategory
);

/**
 * DELETE /v1/admin/categories/:id
 * Delete category (fails if products exist)
 */
adminRouter.delete(
    '/categories/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.deleteCategory
);

/**
 * PATCH /v1/admin/categories/:id/toggle
 * Toggle category active state
 */
adminRouter.patch(
    '/categories/:id/toggle',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.toggleCategory
);

// ============================================================================
// BESTSELLER MANAGEMENT (ADMIN + SUPER_ADMIN)
// ============================================================================

/**
 * GET /v1/admin/bestsellers
 * List all bestsellers (admin view)
 */
adminRouter.get(
    '/bestsellers',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listBestsellers
);

/**
 * POST /v1/admin/bestsellers
 * Create a bestseller entry
 */
adminRouter.post(
    '/bestsellers',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.createBestseller
);

/**
 * PUT /v1/admin/bestsellers/:id
 * Update a bestseller entry
 */
adminRouter.put(
    '/bestsellers/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.updateBestseller
);

/**
 * DELETE /v1/admin/bestsellers/:id
 * Delete a bestseller entry
 */
adminRouter.delete(
    '/bestsellers/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.deleteBestseller
);

// ============================================================================
// REVIEWS MANAGEMENT (ADMIN + SUPER_ADMIN)
// ============================================================================

/**
 * GET /v1/admin/reviews
 * List all reviews
 */
adminRouter.get(
    '/reviews',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listReviews
);

/**
 * DELETE /v1/admin/reviews/:id
 * Delete review
 */
adminRouter.delete(
    '/reviews/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.deleteReview
);

/**
 * PATCH /v1/admin/reviews/:id/hide
 * Hide/unhide a review
 */
adminRouter.patch(
    '/reviews/:id/hide',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.hideReview
);

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

/**
 * GET /v1/admin/orders
 * List all orders
 */
adminRouter.get(
    '/orders',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listOrders
);

/**
 * PUT /v1/admin/orders/:id/cancel
 * Cancel an order (ADMIN + SUPER_ADMIN)
 */
adminRouter.put(
    '/orders/:id/cancel',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.cancelOrder
);

/**
 * PUT /v1/admin/orders/:id/force-confirm
 * Force confirm an order - SUPER_ADMIN ONLY
 * This bypasses payment verification
 */
adminRouter.put(
    '/orders/:id/force-confirm',
    authorize('SUPER_ADMIN'),
    adminController.forceConfirmOrder
);

adminRouter.get(
    '/analytics/profit',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.profitAnalytics
);

// ============================================================================
// PAYMENTS & SETTLEMENTS (READ-ONLY)
// ============================================================================

/**
 * GET /v1/admin/payments
 * List all payments
 */
adminRouter.get(
    '/payments',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listPayments
);

/**
 * GET /v1/admin/settlements
 * List all settlements
 */
adminRouter.get(
    '/settlements',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listSettlements
);

// ============================================================================
// AUDIT LOGS
// ============================================================================

/**
 * GET /v1/admin/audit-logs
 * List audit logs with optional filters
 */
adminRouter.get(
    '/audit-logs',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listAuditLogs
);

// ============================================================================
// REFUND LEDGER
// ============================================================================

/**
 * GET /v1/admin/refunds
 * List all refund ledger entries (with optional orderId/status filters)
 */
adminRouter.get(
    '/refunds',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.listRefunds
);

// ============================================================================
// COMMISSION RULES (ADMIN + SUPER_ADMIN)
// ============================================================================

/**
 * GET /v1/admin/commission-rules
 * List commission rules (with optional seller/category/isActive filters)
 */
adminRouter.get(
    '/commission-rules',
    authorize('ADMIN', 'SUPER_ADMIN'),
    commissionRuleController.listRules
);

/**
 * POST /v1/admin/commission-rules
 * Create a commission rule
 */
adminRouter.post(
    '/commission-rules',
    authorize('ADMIN', 'SUPER_ADMIN'),
    commissionRuleController.createRule
);

/**
 * PUT /v1/admin/commission-rules/:id
 * Update a commission rule
 */
adminRouter.put(
    '/commission-rules/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    commissionRuleController.updateRule
);

/**
 * DELETE /v1/admin/commission-rules/:id
 * Delete a commission rule
 */
adminRouter.delete(
    '/commission-rules/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    commissionRuleController.deleteRule
);

// ============================================================================
// COUPON ADMIN CRUD (ADMIN + SUPER_ADMIN)
// ============================================================================

/**
 * GET /v1/admin/coupons
 * List coupons with pagination/filters
 */
adminRouter.get(
    '/coupons',
    authorize('ADMIN', 'SUPER_ADMIN'),
    couponAdminController.listCoupons
);

/**
 * POST /v1/admin/coupons
 * Create a coupon
 */
adminRouter.post(
    '/coupons',
    authorize('ADMIN', 'SUPER_ADMIN'),
    couponAdminController.createCoupon
);

/**
 * PUT /v1/admin/coupons/:id
 * Update a coupon
 */
adminRouter.put(
    '/coupons/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    couponAdminController.updateCoupon
);

/**
 * DELETE /v1/admin/coupons/:id
 * Delete a coupon (must have 0 redemptions)
 */
adminRouter.delete(
    '/coupons/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    couponAdminController.deleteCoupon
);

/**
 * PATCH /v1/admin/coupons/:id/toggle
 * Toggle coupon active state
 */
adminRouter.patch(
    '/coupons/:id/toggle',
    authorize('ADMIN', 'SUPER_ADMIN'),
    couponAdminController.toggleCoupon
);

// ============================================================================
// OCCASION MANAGEMENT (ADMIN + SUPER_ADMIN)
// ============================================================================

/**
 * GET /v1/admin/occasions
 * List all occasions (active + inactive)
 */
adminRouter.get(
    '/occasions',
    authorize('ADMIN', 'SUPER_ADMIN'),
    occasionController.listAllOccasions
);

/**
 * POST /v1/admin/occasions
 * Create occasion
 */
adminRouter.post(
    '/occasions',
    authorize('ADMIN', 'SUPER_ADMIN'),
    occasionController.createOccasion
);

/**
 * PUT /v1/admin/occasions/:id
 * Update occasion
 */
adminRouter.put(
    '/occasions/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    occasionController.updateOccasion
);

/**
 * DELETE /v1/admin/occasions/:id
 * Delete occasion (fails if products linked)
 */
adminRouter.delete(
    '/occasions/:id',
    authorize('ADMIN', 'SUPER_ADMIN'),
    occasionController.deleteOccasion
);

/**
 * PATCH /v1/admin/occasions/:id/toggle
 * Toggle occasion active state
 */
adminRouter.patch(
    '/occasions/:id/toggle',
    authorize('ADMIN', 'SUPER_ADMIN'),
    occasionController.toggleOccasion
);

// ============================================================================
// PLATFORM SETTINGS (ADMIN + SUPER_ADMIN)
// ============================================================================

/**
 * GET /v1/admin/settings/shipping
 * Current shipping-charge configuration (enabled flag + amount).
 */
adminRouter.get(
    '/settings/shipping',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.getShippingSetting
);

/**
 * PUT /v1/admin/settings/shipping
 * Start/stop the flat shipping charge for new orders.
 */
adminRouter.put(
    '/settings/shipping',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.updateShippingSetting
);

/**
 * GET /v1/admin/settings/gst
 * Current flat-GST-charge configuration (enabled flag + amount).
 */
adminRouter.get(
    '/settings/gst',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.getGstSetting
);

/**
 * PUT /v1/admin/settings/gst
 * Start/stop the flat GST charge for new orders.
 */
adminRouter.put(
    '/settings/gst',
    authorize('ADMIN', 'SUPER_ADMIN'),
    adminController.updateGstSetting
);
