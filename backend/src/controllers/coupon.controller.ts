import type { Request, Response, NextFunction } from 'express';
import { couponService } from '../services/coupon.service.js';

export class CouponController {
    async validateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const code = String(req.body?.code ?? '');
            const result = await couponService.validateCouponCode(userId, code);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
}

export const couponController = new CouponController();
