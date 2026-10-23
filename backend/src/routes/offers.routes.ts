/**
 * Public offers: coupons shoppers can see, the welcome offer, referral and
 * cashback rules, and live sale events. Used by the Offers page, product pages
 * ("Available offers") and checkout.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../config/db.js';
import { listPublicCoupons } from '../services/coupon.service.js';
import { offersConfigService } from '../services/offers-config.service.js';

export const offersRouter = Router();

const h = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.set('Cache-Control', 'public, max-age=60');
        res.json(await fn(req));
    } catch (err) {
        next(err);
    }
};

/** GET /v1/offers — everything on the Offers page. */
offersRouter.get('/', h(async () => {
    const now = new Date();
    const [coupons, config, campaigns] = await Promise.all([
        listPublicCoupons(now),
        offersConfigService.get(),
        prisma.platformCampaign.findMany({
            where: { status: 'PUBLISHED', endsAt: { gte: now } },
            orderBy: { startsAt: 'asc' },
            take: 20,
            select: { id: true, name: true, slug: true, description: true, bannerImage: true, startsAt: true, endsAt: true, minDiscountPercent: true },
        }),
    ]);
    return {
        coupons,
        welcome: config.welcome.enabled ? { amount: config.welcome.amount, minOrder: config.welcome.minOrder } : null,
        referral: config.referral.enabled
            ? { friendAmount: config.referral.friendAmount, referrerAmount: config.referral.referrerAmount, minOrder: config.referral.minOrder }
            : null,
        cashback: config.cashback.enabled
            ? {
                percent: config.cashback.percent,
                maxPerOrder: config.cashback.maxPerOrder,
                holdDays: config.cashback.holdDays,
                expiryDays: config.cashback.expiryDays,
                maxUsePercent: config.cashback.maxUsePercent,
            }
            : null,
        sales: campaigns.map((c) => ({ ...c, live: c.startsAt <= now })),
    };
}));

/** GET /v1/offers/product/:productId — coupons that can apply to this product. */
offersRouter.get('/product/:productId', h(async (req) => {
    const productId = String(req.params['productId']);
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, categoryId: true, sellerId: true } });
    if (!product) return { coupons: [] };
    const coupons = (await listPublicCoupons()).filter((c) => {
        if (c.sellerId && c.sellerId !== product.sellerId) return false;
        if (c.excludedProductIds.includes(product.id) || c.excludedCategoryIds.includes(product.categoryId)) return false;
        const scoped = c.productIds.length || c.categoryIds.length;
        return !scoped || c.productIds.includes(product.id) || c.categoryIds.includes(product.categoryId);
    });
    const config = await offersConfigService.get();
    return {
        coupons,
        welcome: config.welcome.enabled ? { amount: config.welcome.amount, minOrder: config.welcome.minOrder } : null,
        cashbackPercent: config.cashback.enabled ? config.cashback.percent : 0,
    };
}));
