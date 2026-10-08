/**
 * Coupon Admin Controller
 * HTTP handlers for admin coupon CRUD endpoints
 */
import type { Request, Response, NextFunction } from 'express';
export declare const couponAdminController: {
    /**
     * GET /v1/admin/coupons
     */
    listCoupons: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/admin/coupons
     */
    createCoupon: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/admin/coupons/:id
     */
    updateCoupon: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /v1/admin/coupons/:id
     */
    deleteCoupon: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PATCH /v1/admin/coupons/:id/toggle
     */
    toggleCoupon: (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
//# sourceMappingURL=couponAdmin.controller.d.ts.map