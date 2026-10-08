import { Router } from 'express';
import { couponController } from '../controllers/coupon.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { validateCouponSchema } from '../validators/coupon.validation.js';
export const couponRouter = Router();
couponRouter.use(authenticate);
couponRouter.use(authorize('USER'));
couponRouter.post('/validate', validateRequest(validateCouponSchema), (req, res, next) => couponController.validateCoupon(req, res, next));
//# sourceMappingURL=coupon.routes.js.map