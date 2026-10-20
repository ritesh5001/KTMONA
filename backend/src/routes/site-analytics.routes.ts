/**
 * Public storefront analytics beacon.
 * POST /v1/analytics/track — { type, visitorId, productId? }
 */

import { Router } from 'express';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { siteAnalyticsService, trackEventSchema } from '../services/site-analytics.service.js';

export const siteAnalyticsRouter = Router();

siteAnalyticsRouter.post('/track', optionalAuthenticate, (req, res) => {
    const parsed = trackEventSchema.safeParse(req.body ?? {});
    // Always 204: a beacon never fails the page, and a bad payload tells a
    // scraper nothing.
    res.status(204).end();
    if (!parsed.success) return;
    void siteAnalyticsService
        .track(parsed.data, req.user?.userId ?? null, req.headers['user-agent'])
        .catch((err) => console.warn('[analytics] track failed:', err instanceof Error ? err.message : err));
});
