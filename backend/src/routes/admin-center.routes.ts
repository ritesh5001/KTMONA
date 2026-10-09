/**
 * Admin Center (Meesho-style platform operations)
 * Base path: /v1/admin/center — ADMIN / SUPER_ADMIN.
 * Also exports the public sale-event router (/v1/campaigns).
 */

import { storefrontService } from '../services/admin-center/storefront.service.js';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { ApiError } from '../errors/ApiError.js';
import { adminOpsService } from '../services/admin-center/ops.service.js';
import { adminSellersService } from '../services/admin-center/sellers.service.js';
import { adminQcService } from '../services/admin-center/qc.service.js';
import { adminPayoutsService } from '../services/admin-center/payouts.service.js';
import { adminPenaltiesService } from '../services/admin-center/penalties.service.js';
import { campaignsService } from '../services/admin-center/campaigns.service.js';
import { adsEnabledGuard } from './seller-center.routes.js';
import { priceLockReviewSchema, priceLockService } from '../services/price-lock.service.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await fn(req, res);
        if (!res.headersSent) res.json({ success: true, data });
    } catch (err) {
        if (err instanceof z.ZodError) {
            next(ApiError.badRequest(err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')));
            return;
        }
        next(err);
    }
};
const aid = (req: Request) => req.user!.userId;
const param = (req: Request, name: string) => String(req.params[name] ?? '');

export const adminCenterRouter = Router();
adminCenterRouter.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));

// Dashboard
adminCenterRouter.get('/dashboard', h((req) => adminOpsService.dashboard(Number(req.query.days) || 30)));

// KTMONA Price Lock review queue
adminCenterRouter.get('/price-lock', h((req) => priceLockService.adminQueue(req.query)));
adminCenterRouter.post('/price-lock/review', h((req) => priceLockService.adminReview(aid(req), priceLockReviewSchema.parse(req.body))));

// Sellers
adminCenterRouter.get('/sellers', h((req) => adminSellersService.list(req.query)));
adminCenterRouter.get('/sellers/:id', h((req) => adminSellersService.detail(param(req, 'id'))));
adminCenterRouter.post(
    '/sellers/:id/kyc',
    h((req) => adminSellersService.reviewKyc(aid(req), param(req, 'id'), z.object({ status: z.enum(['VERIFIED', 'REJECTED']), reason: z.string().max(300).optional() }).parse(req.body)))
);
adminCenterRouter.post(
    '/sellers/:id/status',
    h((req) => adminSellersService.setStatus(aid(req), param(req, 'id'), z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().max(300).optional(), days: z.number().int().min(1).max(365).optional() }).parse(req.body)))
);
adminCenterRouter.post(
    '/sellers/:id/payout-hold',
    h((req) => adminSellersService.setPayoutHold(param(req, 'id'), z.object({ hold: z.boolean(), reason: z.string().max(300).optional() }).parse(req.body)))
);
adminCenterRouter.put(
    '/sellers/:id/commission',
    h((req) => adminSellersService.setCommission(param(req, 'id'), z.object({ commissionPct: z.number(), platformFee: z.number() }).parse(req.body)))
);

// Catalog QC
adminCenterRouter.get('/qc', h((req) => adminQcService.queue(req.query)));
adminCenterRouter.post(
    '/qc/review',
    h((req) =>
        adminQcService.bulkReview(
            aid(req),
            z.object({ productIds: z.array(z.string()).min(1).max(100), action: z.enum(['APPROVE', 'REJECT']), reason: z.string().max(300).optional() }).parse(req.body)
        )
    )
);

// Dispatch SLA & penalties
adminCenterRouter.get('/sla', h((req) => adminPenaltiesService.slaBoard(req.query)));
adminCenterRouter.post('/sla/auto-cancel', h(() => adminPenaltiesService.runAutoCancel()));
adminCenterRouter.get('/penalties/rules', h(() => adminPenaltiesService.rules()));
adminCenterRouter.put(
    '/penalties/rules',
    h((req) =>
        adminPenaltiesService.saveRules(
            z
                .object({
                    lateDispatchPenalty: z.number().optional(),
                    autoCancelAfterHours: z.number().optional(),
                    autoCancelPenalty: z.number().optional(),
                    sellerCancelPenalty: z.number().optional(),
                })
                .parse(req.body) as never
        )
    )
);
adminCenterRouter.get('/penalties', h((req) => adminPenaltiesService.list(req.query)));
adminCenterRouter.post(
    '/penalties',
    h((req) =>
        adminPenaltiesService.addManual(
            aid(req),
            z
                .object({ sellerId: z.string().min(1), amount: z.number(), note: z.string().trim().min(3).max(300), orderId: z.string().optional(), type: z.enum(['PENALTY', 'ADJUSTMENT']) })
                .parse(req.body)
        )
    )
);
adminCenterRouter.post('/penalties/:id/waive', h((req) => adminPenaltiesService.waive(aid(req), param(req, 'id'))));

// Payouts
adminCenterRouter.get('/payouts/due', h(() => adminPayoutsService.dueSummary()));
adminCenterRouter.get('/payouts', h((req) => adminPayoutsService.history(req.query)));
adminCenterRouter.post(
    '/payouts/:sellerId/pay',
    h((req) =>
        adminPayoutsService.pay(
            aid(req),
            param(req, 'sellerId'),
            z.object({ reference: z.string().trim().min(4).max(60), method: z.enum(['BANK_TRANSFER', 'UPI', 'OTHER']).optional(), note: z.string().max(300).optional(), expectedAmount: z.number().optional() }).parse(req.body)
        )
    )
);
adminCenterRouter.get(
    '/payouts/bank-file',
    h(async (_req, res) => {
        const csv = await adminPayoutsService.bankFileCsv();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="ktmona-payouts-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(csv);
    })
);

// Sale events
const campaignBody = z.object({
    name: z.string().trim().min(3).max(80),
    description: z.string().max(500).nullable().optional(),
    bannerImage: z.string().url().nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    joinDeadline: z.coerce.date().nullable().optional(),
    minDiscountPercent: z.number().min(1).max(80),
    categoryIds: z.array(z.string()).optional(),
});
adminCenterRouter.get('/campaigns', h(() => campaignsService.adminList()));
adminCenterRouter.post('/campaigns', h((req) => campaignsService.create(aid(req), campaignBody.parse(req.body))));
adminCenterRouter.patch(
    '/campaigns/:id',
    h((req) => campaignsService.update(param(req, 'id'), campaignBody.partial().extend({ status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).optional() }).parse(req.body) as never))
);

// Ads oversight
adminCenterRouter.use('/ads', adsEnabledGuard);
adminCenterRouter.get('/ads', h((req) => adminOpsService.ads(Number(req.query.days) || 30)));
adminCenterRouter.patch('/ads/:id', h((req) => adminOpsService.setAdStatus(param(req, 'id'), z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'ENDED']) }).parse(req.body).status)));

// Announcements
const announcementBody = z.object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(3).max(1000),
    level: z.enum(['INFO', 'WARNING', 'SUCCESS']),
    linkUrl: z.string().max(300).nullable().optional(),
    linkLabel: z.string().max(40).nullable().optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
});
adminCenterRouter.get('/announcements', h(() => adminOpsService.listAnnouncements()));
adminCenterRouter.post('/announcements', h((req) => adminOpsService.saveAnnouncement(aid(req), null, announcementBody.parse(req.body))));
adminCenterRouter.put('/announcements/:id', h((req) => adminOpsService.saveAnnouncement(aid(req), param(req, 'id'), announcementBody.parse(req.body))));
adminCenterRouter.delete('/announcements/:id', h((req) => adminOpsService.deleteAnnouncement(param(req, 'id'))));

// =============================================================================
// Public sale events (storefront)
// =============================================================================

adminCenterRouter.get('/storefront/banners', h(() => storefrontService.getBanners()));
adminCenterRouter.put('/storefront/banners', h((req) => storefrontService.saveBanners(req.body)));

export const storefrontPublicRouter = Router();
storefrontPublicRouter.get('/banners', h(() => storefrontService.getBanners()));

export const campaignsPublicRouter = Router();
campaignsPublicRouter.get('/', h(() => campaignsService.publicList()));
campaignsPublicRouter.get('/:slug', h((req) => campaignsService.publicDetail(param(req, 'slug'))));
