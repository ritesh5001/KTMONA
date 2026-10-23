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
import { adminCustomersService } from '../services/admin-center/customers.service.js';
import { siteAnalyticsService } from '../services/site-analytics.service.js';
import { prisma } from '../config/db.js';
import { auditService } from '../services/audit.service.js';
import { categoryLinksSchema, categoryLinksService } from '../services/category-links.service.js';
import { adminReviewCreateSchema, adminReviewUpdateSchema, adminReviewsService, socialProofSchema } from '../services/admin-center/reviews.service.js';
import { adminQcService } from '../services/admin-center/qc.service.js';
import { adminPayoutsService } from '../services/admin-center/payouts.service.js';
import { adminPenaltiesService } from '../services/admin-center/penalties.service.js';
import { campaignsService } from '../services/admin-center/campaigns.service.js';
import { adsEnabledGuard } from './seller-center.routes.js';
import { priceLockReviewSchema, priceLockService } from '../services/price-lock.service.js';
import { sellerPackagingService } from '../services/seller-center/packaging.service.js';
import { categoryRequestService, categoryReviewSchema } from '../services/category-request.service.js';
import { categoryAttributeService, categoryFieldsSchema } from '../services/category-attribute.service.js';
import { reviewService } from '../services/review.service.js';
import { answerQuestionSchema, productTrustService } from '../services/product-trust.service.js';
import { offersConfigService } from '../services/offers-config.service.js';

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
// Website traffic: visitors, seller sign-up attempts, product views (?from=&to=)
adminCenterRouter.get('/traffic', h((req) => siteAnalyticsService.report(req.query)));

// Customers
adminCenterRouter.get('/customers', h((req) => adminCustomersService.list(req.query)));
adminCenterRouter.get('/customers/:id', h((req) => adminCustomersService.detail(param(req, 'id'))));
adminCenterRouter.post(
    '/customers/:id/status',
    h((req) => adminCustomersService.setStatus(aid(req), param(req, 'id'), z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().max(300).optional() }).parse(req.body)))
);
adminCenterRouter.post(
    '/customers/:id/cod',
    h((req) => adminCustomersService.setCod(aid(req), param(req, 'id'), z.object({ disabled: z.boolean() }).parse(req.body).disabled))
);
adminCenterRouter.delete(
    '/customers/:id',
    h((req) => adminCustomersService.deletePermanently(aid(req), param(req, 'id'), z.object({ confirm: z.string().min(1) }).parse(req.body).confirm))
);

// Catalog form fields per category
adminCenterRouter.get('/category-fields/:categoryId', h((req) => categoryAttributeService.adminGet(param(req, 'categoryId'))));
adminCenterRouter.put('/category-fields/:categoryId', h((req) => categoryAttributeService.save(param(req, 'categoryId'), categoryFieldsSchema.parse(req.body))));

// Category requests from sellers
adminCenterRouter.get('/category-requests', h((req) => categoryRequestService.adminList(req.query)));
adminCenterRouter.post('/category-requests/:id/review', h((req) => categoryRequestService.review(aid(req), param(req, 'id'), categoryReviewSchema.parse(req.body))));

// Barcoded packaging supplier shown to sellers ("Buy Barcoded Packets")
adminCenterRouter.get('/packaging-supplier', h(async () => ({ supplier: await sellerPackagingService.getSupplier() })));
adminCenterRouter.put('/packaging-supplier', h((req) => sellerPackagingService.saveSupplier(req.body)));

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
// Cash on Delivery off for every product of this seller.
adminCenterRouter.post(
    '/sellers/:id/cod',
    h(async (req) => {
        const disabled = z.object({ disabled: z.boolean() }).parse(req.body).disabled;
        const updated = await prisma.user.updateMany({ where: { id: param(req, 'id'), role: 'SELLER' }, data: { codDisabled: disabled } });
        if (updated.count === 0) throw ApiError.notFound('Seller not found');
        await auditService.logAction(aid(req), disabled ? 'SELLER_COD_DISABLED' : 'SELLER_COD_ENABLED', 'USER', param(req, 'id'), {});
        return adminSellersService.detail(param(req, 'id'));
    })
);
adminCenterRouter.post(
    '/sellers/:id/kyc-required',
    h((req) => adminSellersService.setKycRequired(aid(req), param(req, 'id'), z.object({ required: z.boolean() }).parse(req.body).required))
);
// Customer menu ↔ seller categories.
adminCenterRouter.post('/categories/auto-link', h(() => categoryLinksService.autoLink({ apply: true })));
adminCenterRouter.get('/categories/:id/links', h((req) => categoryLinksService.get(param(req, 'id'))));
adminCenterRouter.put('/categories/:id/links', h((req) => categoryLinksService.set(param(req, 'id'), categoryLinksSchema.parse(req.body).sellerCategoryIds)));

// Ratings & reviews: storefront figures per product, and admin-written reviews.
adminCenterRouter.get('/reviews/products', h((req) => adminReviewsService.searchProducts(req.query)));
adminCenterRouter.get('/reviews/products/:id', h((req) => adminReviewsService.productDetail(param(req, 'id'))));
adminCenterRouter.put('/reviews/products/:id/social-proof', h((req) => adminReviewsService.setSocialProof(aid(req), param(req, 'id'), socialProofSchema.parse(req.body))));
adminCenterRouter.post('/reviews', h((req) => adminReviewsService.create(aid(req), adminReviewCreateSchema.parse(req.body))));
adminCenterRouter.patch('/reviews/:id', h((req) => adminReviewsService.update(param(req, 'id'), adminReviewUpdateSchema.parse(req.body))));
adminCenterRouter.post('/reviews/:id/hidden', h((req) => adminReviewsService.setHidden(param(req, 'id'), z.object({ hidden: z.boolean() }).parse(req.body).hidden)));
adminCenterRouter.delete('/reviews/:id', h((req) => adminReviewsService.remove(param(req, 'id'))));

// ---- Review trust: reported reviews ----
adminCenterRouter.get('/reviews-reported', h(() => reviewService.listReported()));
adminCenterRouter.post('/reviews-reported/:id/resolve', h((req) => reviewService.resolveReports(param(req, 'id'), z.object({ action: z.enum(['KEEP', 'REMOVE']) }).parse(req.body).action)));

// ---- Product Q&A and incorrect-information reports ----
adminCenterRouter.get('/product-questions', h(() => productTrustService.adminQuestions()));
adminCenterRouter.post('/product-questions/:id/answer', h((req) => productTrustService.answer(param(req, 'id'), { userId: aid(req), role: req.user!.role }, answerQuestionSchema.parse(req.body).answer)));
adminCenterRouter.post('/product-questions/:id/hidden', h((req) => productTrustService.setQuestionHidden(param(req, 'id'), z.object({ hidden: z.boolean() }).parse(req.body).hidden)));
adminCenterRouter.get('/product-reports', h((req) => productTrustService.adminReports((String(req.query['status'] ?? 'OPEN').toUpperCase() as 'OPEN' | 'RESOLVED' | 'ALL'))));
adminCenterRouter.post('/product-reports/:id/resolve', h((req) => productTrustService.resolveReport(param(req, 'id'))));

// ---- Offers: cashback, referral and welcome-offer rules ----
adminCenterRouter.get('/offers-config', h(() => offersConfigService.get()));
adminCenterRouter.put('/offers-config', h((req) => offersConfigService.update(req.body)));
adminCenterRouter.delete(
    '/sellers/:id',
    h((req) => adminSellersService.deletePermanently(aid(req), param(req, 'id'), z.object({ confirm: z.string().min(1) }).parse(req.body).confirm))
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

adminCenterRouter.put(
    '/qc/:id/category',
    h((req) => adminQcService.changeCategory(param(req, 'id'), aid(req), z.object({ categoryId: z.string().min(1) }).parse(req.body).categoryId))
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
