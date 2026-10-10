import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors/ApiError.js';
import { profileService, refundDetailsSchema, updateProfileSchema } from '../services/profile.service.js';

const h = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.set('Cache-Control', 'private, no-store');
        res.json(await fn(req));
    } catch (err) {
        if (err instanceof ZodError) {
            next(ApiError.badRequest(err.issues.map((i) => i.message).join('; ')));
            return;
        }
        next(err);
    }
};

/**
 * Profile Routes
 * Base path: /v1/me
 *
 * Always scoped to the caller's own token — there is no :userId anywhere here,
 * so one account can never read or modify another's profile.
 */
const profileRouter = Router();

profileRouter.use(authenticate);

/** GET /v1/me — the signed-in user's profile, including their avatar. */
profileRouter.get('/', profileController.getProfile);

/** PATCH /v1/me/avatar — set the avatar URL, or null to remove it. */
profileRouter.patch('/avatar', profileController.updateAvatar);

/** PATCH /v1/me — edit name, gender, date of birth. */
profileRouter.patch('/', h((req) => profileService.updateProfile(req.user!.userId, updateProfileSchema.parse(req.body))));

/** Bank / UPI details for refunds of Cash on Delivery orders. */
profileRouter.get('/refund-details', h((req) => profileService.getRefundDetails(req.user!.userId)));
profileRouter.put('/refund-details', h((req) => profileService.saveRefundDetails(req.user!.userId, refundDetailsSchema.parse(req.body))));
profileRouter.delete('/refund-details', h((req) => profileService.deleteRefundDetails(req.user!.userId)));

export { profileRouter };
