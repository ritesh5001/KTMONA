/**
 * Coupon Admin Controller
 * HTTP handlers for admin coupon CRUD endpoints
 */
import { couponAdminService } from '../services/couponAdmin.service.js';
import { createCouponSchema, updateCouponSchema, couponQuerySchema, } from '../validators/couponAdmin.validation.js';
export const couponAdminController = {
    /**
     * GET /v1/admin/coupons
     */
    listCoupons: async (req, res, next) => {
        try {
            const query = couponQuerySchema.parse(req.query);
            const result = await couponAdminService.listCoupons(query);
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * POST /v1/admin/coupons
     */
    createCoupon: async (req, res, next) => {
        try {
            const validated = createCouponSchema.parse(req.body);
            const coupon = await couponAdminService.createCoupon(validated);
            res.status(201).json({ message: 'Coupon created', coupon });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * PUT /v1/admin/coupons/:id
     */
    updateCoupon: async (req, res, next) => {
        try {
            const id = req.params['id'];
            const validated = updateCouponSchema.parse(req.body);
            const coupon = await couponAdminService.updateCoupon(id, validated);
            res.json({ message: 'Coupon updated', coupon });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * DELETE /v1/admin/coupons/:id
     */
    deleteCoupon: async (req, res, next) => {
        try {
            const id = req.params['id'];
            await couponAdminService.deleteCoupon(id);
            res.json({ message: 'Coupon deleted' });
        }
        catch (error) {
            next(error);
        }
    },
    /**
     * PATCH /v1/admin/coupons/:id/toggle
     */
    toggleCoupon: async (req, res, next) => {
        try {
            const id = req.params['id'];
            const coupon = await couponAdminService.toggleCoupon(id);
            res.json({
                message: coupon.isActive ? 'Coupon activated' : 'Coupon deactivated',
                coupon,
            });
        }
        catch (error) {
            next(error);
        }
    },
};
//# sourceMappingURL=couponAdmin.controller.js.map