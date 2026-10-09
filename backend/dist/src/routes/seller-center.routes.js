/**
 * Seller Center (Meesho-style supplier panel)
 * Base path: /v1/seller/center — SELLER role only.
 *
 * Also exports the public ads router (/v1/ads) and the admin claims router
 * (/v1/admin/seller-claims).
 */
import express, { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { ApiError } from '../errors/ApiError.js';
import { getFromCache, setCache } from '../utils/cache.util.js';
import { prisma } from '../config/db.js';
import { sellerDashboardService } from '../services/seller-center/dashboard.service.js';
import { sellerOrdersService } from '../services/seller-center/orders.service.js';
import { sellerCatalogService } from '../services/seller-center/catalog.service.js';
import { sellerReturnsService } from '../services/seller-center/returns.service.js';
import { sellerPaymentsService } from '../services/seller-center/payments.service.js';
import { sellerPricingService } from '../services/seller-center/pricing.service.js';
import { sellerAdsService } from '../services/seller-center/ads.service.js';
import { env } from '../config/env.js';
import { sellerInsightsService, LATE_DISPATCH_PENALTY_KEY } from '../services/seller-center/insights.service.js';
import { sellerSettingsService } from '../services/seller-center/settings.service.js';
import { campaignsService } from '../services/admin-center/campaigns.service.js';
import { adminOpsService } from '../services/admin-center/ops.service.js';
/** Wrap a handler: JSON envelope, zod errors as 400, everything else to next(). */
const h = (fn) => async (req, res, next) => {
    try {
        const data = await fn(req, res);
        if (!res.headersSent)
            res.json({ success: true, data });
    }
    catch (err) {
        if (err instanceof z.ZodError) {
            next(ApiError.badRequest(err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')));
            return;
        }
        next(err);
    }
};
const sid = (req) => req.user.userId;
const param = (req, name) => String(req.params[name] ?? '');
const ids = z.object({ orderIds: z.array(z.string().min(1)).min(1).max(100) });
const xlsx = express.raw({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
    limit: '10mb',
});
function sendFile(res, buffer, fileName, type) {
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
}
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// =============================================================================
// Seller center
// =============================================================================
/** 404s every ads endpoint while KTMONA Ads is switched off (FEATURE_ADS). */
export function adsEnabledGuard(_req, _res, next) {
    if (env.FEATURE_ADS)
        return next();
    next(ApiError.notFound('KTMONA Ads is turned off'));
}
export const sellerCenterRouter = Router();
sellerCenterRouter.use(authenticate, authorize('SELLER'));
// Dashboard
sellerCenterRouter.get('/overview', h((req) => sellerDashboardService.overview(sid(req), Number(req.query.days) || 7)));
// Orders
sellerCenterRouter.get('/orders', h((req) => sellerOrdersService.list(sid(req), req.query)));
sellerCenterRouter.get('/orders/counts', h((req) => sellerOrdersService.counts(sid(req))));
sellerCenterRouter.get('/orders/:orderId', h((req) => sellerOrdersService.detail(sid(req), param(req, 'orderId'))));
sellerCenterRouter.post('/orders/accept', h((req) => sellerOrdersService.accept(sid(req), ids.parse(req.body).orderIds)));
sellerCenterRouter.post('/orders/ship', h((req) => sellerOrdersService.markShipped(sid(req), ids.parse(req.body).orderIds)));
sellerCenterRouter.post('/orders/:orderId/deliver', h((req) => sellerOrdersService.markDelivered(sid(req), param(req, 'orderId'))));
sellerCenterRouter.put('/orders/:orderId/tracking', h((req) => {
    const body = z.object({ carrier: z.string().trim().min(2).max(60), awb: z.string().trim().min(4).max(40) }).parse(req.body);
    return sellerOrdersService.updateTracking(sid(req), param(req, 'orderId'), body.carrier, body.awb);
}));
sellerCenterRouter.post('/orders/:orderId/cancel', h((req) => sellerOrdersService.cancel(sid(req), param(req, 'orderId'), z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body).reason)));
sellerCenterRouter.post('/orders/:orderId/approve-cancellation', h((req) => sellerOrdersService.approveCustomerCancellation(sid(req), param(req, 'orderId'))));
sellerCenterRouter.post('/orders/:orderId/rto', h((req) => {
    const body = z.object({ action: z.enum(['initiated', 'received']), reason: z.string().max(300).optional() }).parse(req.body);
    return sellerOrdersService.rto(sid(req), param(req, 'orderId'), body.action, body.reason);
}));
sellerCenterRouter.post('/orders/labels', h(async (req, res) => {
    const pdf = await sellerOrdersService.labelsPdf(sid(req), ids.parse(req.body).orderIds);
    sendFile(res, pdf, `ktmona-labels-${Date.now()}.pdf`, 'application/pdf');
}));
sellerCenterRouter.post('/orders/manifest', h(async (req, res) => {
    const { pdf, manifestId } = await sellerOrdersService.manifestPdf(sid(req), ids.parse(req.body).orderIds);
    sendFile(res, pdf, `${manifestId}.pdf`, 'application/pdf');
}));
// Catalog & inventory
sellerCenterRouter.get('/catalog', h((req) => sellerCatalogService.list(sid(req), req.query)));
sellerCenterRouter.post('/catalog/pause', h((req) => {
    const body = z.object({ productIds: z.array(z.string()).min(1).max(200), paused: z.boolean() }).parse(req.body);
    return sellerCatalogService.setPaused(sid(req), body.productIds, body.paused);
}));
sellerCenterRouter.get('/catalog/template', h(async (req, res) => {
    const categoryId = z.string().min(1).parse(req.query.categoryId);
    const { file, fileName } = await sellerCatalogService.catalogTemplate(categoryId);
    sendFile(res, file, fileName, XLSX_TYPE);
}));
sellerCenterRouter.post('/catalog/bulk-upload', xlsx, h((req) => {
    const categoryId = z.string().min(1).parse(req.query.categoryId);
    if (!Buffer.isBuffer(req.body) || req.body.length === 0)
        throw ApiError.badRequest('Attach the filled .xlsx template');
    return sellerCatalogService.importCatalog(sid(req), categoryId, req.body);
}));
sellerCenterRouter.get('/inventory', h((req) => sellerCatalogService.inventory(sid(req), req.query)));
sellerCenterRouter.put('/inventory', h((req) => {
    const body = z.object({ updates: z.array(z.object({ variantId: z.string(), stock: z.number().int().min(0) })).min(1).max(500) }).parse(req.body);
    return sellerCatalogService.bulkUpdateStock(sid(req), body.updates);
}));
sellerCenterRouter.get('/inventory/export', h(async (req, res) => sendFile(res, await sellerCatalogService.inventoryWorkbook(sid(req)), 'ktmona-inventory.xlsx', XLSX_TYPE)));
sellerCenterRouter.post('/inventory/import', xlsx, h((req) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0)
        throw ApiError.badRequest('Attach the inventory .xlsx file');
    return sellerCatalogService.importInventoryWorkbook(sid(req), req.body);
}));
// Returns, RTO & claims
sellerCenterRouter.get('/returns', h((req) => sellerReturnsService.listReturns(sid(req), req.query)));
sellerCenterRouter.get('/rto', h((req) => sellerReturnsService.listRto(sid(req), req.query)));
sellerCenterRouter.get('/claims', h((req) => sellerReturnsService.listClaims(sid(req), req.query)));
sellerCenterRouter.post('/claims', h((req) => {
    const body = z
        .object({
        orderId: z.string().min(1),
        returnId: z.string().optional(),
        type: z.enum(['DAMAGED_RETURN', 'WRONG_RETURN', 'MISSING_ITEM_IN_RETURN', 'RTO_DAMAGED', 'RTO_NOT_RECEIVED', 'PAYMENT_ISSUE', 'OTHER']),
        description: z.string().trim().min(10).max(2000),
        images: z.array(z.string().url()).max(6).optional(),
        amountClaimed: z.number().positive().optional(),
    })
        .parse(req.body);
    return sellerReturnsService.createClaim(sid(req), body);
}));
// Payments
sellerCenterRouter.get('/payments/summary', h((req) => sellerPaymentsService.summary(sid(req))));
sellerCenterRouter.get('/payments/orders', h((req) => sellerPaymentsService.orders(sid(req), req.query)));
sellerCenterRouter.get('/payments/ledger', h((req) => sellerPaymentsService.ledger(sid(req), req.query)));
sellerCenterRouter.get('/payments/statement', h(async (req, res) => {
    const from = new Date(String(req.query.from ?? ''));
    const to = new Date(String(req.query.to ?? ''));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to)
        throw ApiError.badRequest('Pick a valid date range');
    const csv = await sellerPaymentsService.statementCsv(sid(req), from, to);
    sendFile(res, Buffer.from(csv, 'utf8'), `ktmona-statement-${req.query.from}-to-${req.query.to}.csv`, 'text/csv; charset=utf-8');
}));
// Pricing & offers
sellerCenterRouter.get('/pricing', h((req) => sellerPricingService.list(sid(req), req.query)));
sellerCenterRouter.get('/pricing/calculator', h((req) => sellerPricingService.calculator(sid(req), z.coerce.number().positive().parse(req.query.price))));
sellerCenterRouter.put('/pricing/:variantId', h((req) => {
    const body = z.object({ sellerPrice: z.number().positive().optional(), mrp: z.number().positive().nullable().optional() }).parse(req.body);
    return sellerPricingService.updatePrice(sid(req), param(req, 'variantId'), body);
}));
sellerCenterRouter.get('/offers', h((req) => sellerPricingService.listOffers(sid(req))));
sellerCenterRouter.post('/offers', h((req) => {
    const body = z
        .object({
        name: z.string().trim().min(3).max(80),
        discountPercent: z.number().min(1).max(80),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        productIds: z.array(z.string()).min(1).max(200),
    })
        .parse(req.body);
    return sellerPricingService.createOffer(sid(req), body);
}));
sellerCenterRouter.post('/offers/:offerId/cancel', h((req) => sellerPricingService.cancelOffer(sid(req), param(req, 'offerId'))));
// Ads
sellerCenterRouter.use('/ads', adsEnabledGuard);
sellerCenterRouter.get('/ads', h((req) => sellerAdsService.listCampaigns(sid(req), req.query)));
const campaignBody = z.object({
    name: z.string().trim().min(3).max(80),
    dailyBudget: z.number().positive(),
    bidPerClick: z.number().positive(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    productIds: z.array(z.string()).min(1).max(100),
});
sellerCenterRouter.post('/ads', h((req) => sellerAdsService.createCampaign(sid(req), campaignBody.parse(req.body))));
sellerCenterRouter.patch('/ads/:campaignId', h((req) => {
    const body = campaignBody.partial().extend({ status: z.enum(['ACTIVE', 'PAUSED', 'ENDED']).optional() }).parse(req.body);
    return sellerAdsService.updateCampaign(sid(req), param(req, 'campaignId'), body);
}));
// Sale events & announcements
sellerCenterRouter.get('/campaigns', h((req) => campaignsService.sellerList(sid(req))));
sellerCenterRouter.post('/campaigns/:campaignId/join', h((req) => campaignsService.join(sid(req), param(req, 'campaignId'), z.object({ productIds: z.array(z.string()).min(1).max(200), discountPercent: z.number().min(1).max(80) }).parse(req.body))));
sellerCenterRouter.post('/campaigns/:campaignId/leave', h((req) => campaignsService.leave(sid(req), param(req, 'campaignId'))));
sellerCenterRouter.get('/announcements', h(() => adminOpsService.activeAnnouncements()));
// Performance
sellerCenterRouter.get('/health', h((req) => sellerInsightsService.health(sid(req), Number(req.query.days) || 30)));
sellerCenterRouter.get('/insights', h((req) => sellerInsightsService.business(sid(req), Math.min(Number(req.query.days) || 30, 90))));
// Settings
sellerCenterRouter.get('/settings', h((req) => sellerSettingsService.get(sid(req))));
sellerCenterRouter.get('/settings/store-name-available', h((req) => sellerSettingsService.storeNameAvailable(z.string().trim().min(3).parse(req.query.name), sid(req))));
sellerCenterRouter.put('/settings/store', h((req) => {
    const body = z
        .object({
        name: z.string().trim().min(3).max(60),
        description: z.string().max(500).nullable().optional(),
        logo: z.string().url().nullable().optional(),
        supportEmail: z.string().email().nullable().optional(),
        supportPhone: z.string().max(15).nullable().optional(),
    })
        .parse(req.body);
    return sellerSettingsService.updateStore(sid(req), body);
}));
sellerCenterRouter.put('/settings/business', h((req) => {
    const body = z
        .object({
        businessType: z.enum(['INDIVIDUAL', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PROPRIETORSHIP']),
        gstRegistered: z.boolean(),
        gstin: z.string().nullable().optional(),
        enrolmentId: z.string().nullable().optional(),
        pan: z.string().min(10).max(10),
        state: z.string().min(2).max(60),
    })
        .parse(req.body);
    return sellerSettingsService.updateBusiness(sid(req), body);
}));
sellerCenterRouter.put('/settings/pickup', h((req) => {
    const body = z
        .object({
        contactName: z.string().trim().min(2).max(80),
        phone: z.string().min(10).max(15),
        line1: z.string().trim().min(5).max(200),
        line2: z.string().max(200).nullable().optional(),
        city: z.string().trim().min(2).max(60),
        state: z.string().trim().min(2).max(60),
        pincode: z.string().trim().length(6),
    })
        .parse(req.body);
    return sellerSettingsService.updatePickup(sid(req), body);
}));
sellerCenterRouter.post('/settings/bank', h((req) => {
    const body = z
        .object({
        bankName: z.string().trim().min(2).max(80),
        holderName: z.string().trim().min(2).max(80),
        accountNumber: z.string().min(9).max(20),
        ifsc: z.string().length(11),
    })
        .parse(req.body);
    return sellerSettingsService.upsertBank(sid(req), body);
}));
sellerCenterRouter.put('/settings/vacation', h((req) => sellerSettingsService.setVacation(sid(req), z.object({ on: z.boolean() }).parse(req.body).on)));
// =============================================================================
// Public ads (storefront)
// =============================================================================
export const adsRouter = Router();
adsRouter.use(adsEnabledGuard);
adsRouter.get('/sponsored', h(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    return sellerAdsService.sponsored({
        categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
        search: typeof req.query.search === 'string' ? req.query.search.slice(0, 80) : undefined,
        limit: Number(req.query.limit) || 4,
        excludeIds: typeof req.query.exclude === 'string' ? req.query.exclude.split(',').slice(0, 50) : undefined,
    });
}));
adsRouter.post('/click', h(async (req) => {
    const body = z.object({ campaignId: z.string().min(1), productId: z.string().min(1) }).parse(req.body);
    // One charge per visitor per product per 30 minutes (click-fraud guard).
    const key = `ads:click:${req.ip}:${body.campaignId}:${body.productId}`;
    if (await getFromCache(key))
        return { charged: 0, deduped: true };
    await setCache(key, true, 30 * 60);
    return sellerAdsService.click(body.campaignId, body.productId);
}));
// =============================================================================
// Admin: seller claims & seller-center settings
// =============================================================================
export const adminSellerClaimsRouter = Router();
adminSellerClaimsRouter.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));
adminSellerClaimsRouter.get('/', h((req) => sellerReturnsService.adminList(req.query)));
adminSellerClaimsRouter.post('/:claimId/review', h((req) => {
    const body = z
        .object({ status: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED']), amountApproved: z.number().min(0).optional(), note: z.string().max(500).optional() })
        .parse(req.body);
    return sellerReturnsService.adminReview(req.user.userId, param(req, 'claimId'), body);
}));
adminSellerClaimsRouter.get('/settings', h(async () => {
    const row = await prisma.appSetting.findUnique({ where: { key: LATE_DISPATCH_PENALTY_KEY } });
    return { lateDispatchPenalty: Number(row?.value ?? 0) };
}));
adminSellerClaimsRouter.put('/settings', h(async (req) => {
    const { lateDispatchPenalty } = z.object({ lateDispatchPenalty: z.number().min(0).max(1000) }).parse(req.body);
    await prisma.appSetting.upsert({
        where: { key: LATE_DISPATCH_PENALTY_KEY },
        create: { key: LATE_DISPATCH_PENALTY_KEY, value: String(lateDispatchPenalty) },
        update: { value: String(lateDispatchPenalty) },
    });
    return { lateDispatchPenalty };
}));
//# sourceMappingURL=seller-center.routes.js.map