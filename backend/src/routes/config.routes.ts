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
    DEFAULT_SHIPPING_FEE_INR,
    FLAT_GST_FEE_INR,
} from '../services/settings.service.js';
import { fastrrController } from '../controllers/fastrr.controller.js';

export const configRouter = Router();

/**
 * GET /v1/config/checkout
 * Which checkout the client should render: Shiprocket's Fastrr overlay, or the
 * native address-form + PhonePe flow. Server-side so the switch reaches app
 * builds already on buyers' phones without a release.
 */
configRouter.get('/checkout', (req, res, next) =>
    fastrrController.getCheckoutConfig(req, res, next),
);

/**
 * GET /v1/config/shipping
 * Current shipping-charge configuration for display in cart/checkout.
 */
configRouter.get('/shipping', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const enabled = await settingsService.isShippingChargeEnabled();
        res.json({ enabled, amount: enabled ? DEFAULT_SHIPPING_FEE_INR : 0 });
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
        const enabled = await settingsService.isGstChargeEnabled();
        res.json({ enabled, amount: enabled ? FLAT_GST_FEE_INR : 0 });
    } catch (error) {
        next(error);
    }
});
