import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { ApiError } from '../errors/ApiError.js';
import { profileService, refundDetailsSchema, updateProfileSchema } from '../services/profile.service.js';
import {
    accountSettingsService,
    deletionRequestSchema,
    notificationPreferencesSchema,
} from '../services/account-settings.service.js';
import { savedPaymentsService } from '../services/saved-payments.service.js';
import { walletService } from '../services/wallet.service.js';
import { referralService } from '../services/referral.service.js';
import { productAlertsService } from '../services/product-alerts.service.js';

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

/** Notification consent: email / SMS / WhatsApp order updates, and offers. */
profileRouter.get('/notification-preferences', h((req) => accountSettingsService.getNotificationPreferences(req.user!.userId)));
profileRouter.put('/notification-preferences', h((req) => accountSettingsService.updateNotificationPreferences(req.user!.userId, notificationPreferencesSchema.parse(req.body))));

/** Account deletion request (completed by an admin), and withdrawing it. */
profileRouter.get('/deletion-request', h((req) => accountSettingsService.getDeletionRequest(req.user!.userId)));
profileRouter.post('/deletion-request', h((req) => accountSettingsService.requestDeletion(req.user!.userId, deletionRequestSchema.parse(req.body ?? {}).reason)));
profileRouter.delete('/deletion-request', h((req) => accountSettingsService.cancelDeletion(req.user!.userId)));

/** Cards / UPI saved with Razorpay (tokens only — no card data is stored here). */
profileRouter.get('/saved-payment-methods', h((req) => savedPaymentsService.list(req.user!.userId)));
profileRouter.delete('/saved-payment-methods/:tokenId', h((req) => savedPaymentsService.remove(req.user!.userId, req.params.tokenId as string)));

/** Cashback wallet: balance, pending, expiry and history. */
profileRouter.get('/wallet', h((req) => walletService.summary(req.user!.userId)));
profileRouter.get('/wallet/transactions', h((req) => walletService.transactions(req.user!.userId, Number(req.query['page'] ?? 1) || 1)));

/** Referral program: code, share link, friends and rewards. */
profileRouter.get('/referrals', h((req) => referralService.overview(req.user!.userId)));

/** Back-in-stock alerts ("Notify me"). */
const alertBody = z.object({ productId: z.string().min(1), variantId: z.string().min(1).optional() });
profileRouter.get('/alerts', h((req) => productAlertsService.mine(req.user!.userId)));
profileRouter.post('/alerts/back-in-stock', h((req) => {
    const body = alertBody.parse(req.body);
    return productAlertsService.subscribeBackInStock(req.user!.userId, body.productId, body.variantId ?? null);
}));
profileRouter.delete('/alerts/back-in-stock', h((req) => {
    const body = alertBody.parse(req.body ?? {});
    return productAlertsService.unsubscribe(req.user!.userId, body.productId, body.variantId ?? null);
}));

export { profileRouter };
