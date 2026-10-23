/**
 * Public Config Routes
 *
 * Unauthenticated, read-only platform configuration consumed by the
 * storefront and mobile checkout to render accurate cost estimates
 * (e.g. whether the shipping / GST charges currently apply).
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
    settingsService,
    COD_MAX_ORDER_INR,
} from '../services/settings.service.js';

export const configRouter = Router();

/**
 * GET /v1/config/shipping
 * Current shipping-charge configuration for display in cart/checkout.
 */
configRouter.get('/shipping', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const [enabled, freeAbove] = await Promise.all([
            settingsService.isShippingChargeEnabled(),
            settingsService.getFreeShippingMinOrder(),
        ]);
        res.json({ enabled, amount: enabled ? await settingsService.getShippingFeeAmount() : 0, freeAbove });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/config/gst
 * Current flat-GST-charge configuration for display in cart/checkout.
 * `amount` is the per-unit flat fee (0 when disabled).
 */
configRouter.get('/gst', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        // "GST" kept in the path for older app builds; this is the platform fee.
        const rules = await settingsService.getPlatformFeeRules();
        res.json({ enabled: rules.enabled, amount: rules.enabled ? rules.amount : 0, mode: rules.mode });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/config/cod
 * Whether Cash on Delivery is offered, and the largest order total it covers.
 */
configRouter.get('/cod', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const enabled = await settingsService.isCodEnabled();
        res.json({ enabled, maxOrderAmount: COD_MAX_ORDER_INR });
    } catch (error) {
        next(error);
    }
});
