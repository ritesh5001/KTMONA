/**
 * Shopper alerts:
 *  - Back in stock: "Notify me" on a sold-out size/colour (or any size).
 *  - Price drop: automatic for wishlist items, when the lowest price falls by
 *    5% or more below the price when saved (or when last alerted).
 * Both are checked by the maintenance sweep and sent as in-app + email notices.
 */

import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../errors/ApiError.js';
import { notificationService } from '../notifications/notification.service.js';

const log = logger.child({ module: 'product-alerts' });
/** A drop smaller than this is not worth a notification. */
const PRICE_DROP_MIN = 0.05;

async function lowestPrices(productIds: string[]) {
    if (!productIds.length) return new Map<string, number>();
    const rows = await prisma.productVariant.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, status: 'APPROVED' },
        _min: { price: true },
    });
    return new Map(rows.filter((r) => r._min.price != null).map((r) => [r.productId, Number(r._min.price)]));
}

export const productAlertsService = {
    async subscribeBackInStock(userId: string, productId: string, variantId?: string | null) {
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
        if (!product) throw ApiError.notFound('Product not found');
        if (variantId) {
            const v = await prisma.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
            if (!v) throw ApiError.badRequest('That size/colour does not belong to this product');
        }
        await prisma.productAlert.upsert({
            where: { userId_productId_variantId_type: { userId, productId, variantId: variantId ?? '', type: 'BACK_IN_STOCK' } },
            create: { userId, productId, variantId: variantId ?? '', type: 'BACK_IN_STOCK' },
            update: { notifiedAt: null },
        });
        return { subscribed: true };
    },

    async unsubscribe(userId: string, productId: string, variantId?: string | null) {
        await prisma.productAlert.deleteMany({ where: { userId, productId, variantId: variantId ?? '', type: 'BACK_IN_STOCK' } });
        return { subscribed: false };
    },

    async mine(userId: string) {
        const alerts = await prisma.productAlert.findMany({
            where: { userId, type: 'BACK_IN_STOCK', notifiedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return { alerts: alerts.map((a) => ({ id: a.id, productId: a.productId, variantId: a.variantId || null, createdAt: a.createdAt.toISOString() })) };
    },

    async sweep(): Promise<{ restock: number; priceDrop: number }> {
        let restock = 0;
        let priceDrop = 0;

        // Back in stock
        const waiting = await prisma.productAlert.findMany({ where: { type: 'BACK_IN_STOCK', notifiedAt: null }, take: 1000 });
        if (waiting.length) {
            const productIds = [...new Set(waiting.map((a) => a.productId))];
            const [variants, products] = await Promise.all([
                prisma.productVariant.findMany({
                    where: { productId: { in: productIds }, status: 'APPROVED' },
                    select: { id: true, productId: true, size: true, color: true, inventory: { select: { stock: true } } },
                }),
                prisma.product.findMany({
                    where: { id: { in: productIds }, status: 'APPROVED', deletedByAdmin: false, pausedBySeller: false, pausedForVacation: false },
                    select: { id: true, title: true },
                }),
            ]);
            const live = new Map(products.map((p) => [p.id, p.title]));
            for (const a of waiting) {
                const title = live.get(a.productId);
                if (!title) continue;
                const inStock = variants.filter((v) => v.productId === a.productId && (!a.variantId || v.id === a.variantId) && (v.inventory?.stock ?? 0) > 0);
                if (!inStock.length) continue;
                const v = a.variantId ? inStock[0] : null;
                const label = v ? [v.color, v.size !== 'Default' ? v.size : null].filter(Boolean).join(' / ') : '';
                await notificationService.create({
                    userId: a.userId,
                    role: 'USER',
                    type: 'ORDER_UPDATE',
                    channel: 'EMAIL',
                    content: `Back in stock: ${title}`,
                    metadata: {
                        title: 'Back in stock',
                        message: `${title}${label ? ` (${label})` : ''} is available again. Grab it before it sells out.`,
                        productId: a.productId,
                    },
                    eventKey: `BACK_IN_STOCK:${a.id}:${Date.now()}`,
                }).catch(() => undefined);
                await prisma.productAlert.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
                restock += 1;
            }
        }

        // Wishlist price drops
        const items = await prisma.wishlistItem.findMany({
            select: { id: true, productId: true, priceAtAdd: true, wishlist: { select: { userId: true } }, product: { select: { title: true, status: true, deletedByAdmin: true } } },
            take: 5000,
        });
        const prices = await lowestPrices([...new Set(items.map((i) => i.productId))]);
        for (const item of items) {
            const now = prices.get(item.productId);
            if (now == null || item.product.status !== 'APPROVED' || item.product.deletedByAdmin) continue;
            if (item.priceAtAdd == null) {
                await prisma.wishlistItem.update({ where: { id: item.id }, data: { priceAtAdd: now } });
                continue;
            }
            if (now <= item.priceAtAdd * (1 - PRICE_DROP_MIN)) {
                const saved = Math.round(item.priceAtAdd - now);
                await notificationService.create({
                    userId: item.wishlist.userId,
                    role: 'USER',
                    type: 'ORDER_UPDATE',
                    channel: 'EMAIL',
                    content: `Price drop: ${item.product.title}`,
                    metadata: {
                        title: 'Price drop on your wishlist',
                        message: `${item.product.title} is now ₹${now.toLocaleString('en-IN')} — ₹${saved.toLocaleString('en-IN')} less than when you saved it.`,
                        productId: item.productId,
                    },
                    eventKey: `PRICE_DROP:${item.id}:${now}`,
                }).catch(() => undefined);
                priceDrop += 1;
                await prisma.wishlistItem.update({ where: { id: item.id }, data: { priceAtAdd: now } });
            } else if (now > item.priceAtAdd) {
                // A price rise resets the baseline; small dips keep it, so slow drops still add up.
                await prisma.wishlistItem.update({ where: { id: item.id }, data: { priceAtAdd: now } });
            }
        }

        if (restock || priceDrop) log.info({ restock, priceDrop }, 'product alerts sent');
        return { restock, priceDrop };
    },
};
