/**
 * Performance: business insights and account health (quality score), plus
 * the late-dispatch penalty sweep.
 */

import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { DISPATCH_SLA_HOURS, LOW_STOCK_THRESHOLD, addDays, dispatchBy, pctChange, round2, utcDay } from './common.js';

const log = logger.child({ module: 'seller-insights' });
export const LATE_DISPATCH_PENALTY_KEY = 'seller.late_dispatch_penalty';

export async function getLateDispatchPenalty(): Promise<number> {
    const row = await prisma.appSetting.findUnique({ where: { key: LATE_DISPATCH_PENALTY_KEY } });
    const value = Number(row?.value ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

interface Thresholds {
    good: number;
    risk: number;
    higherIsBetter?: boolean;
}

function band(value: number | null, t: Thresholds): 'GOOD' | 'AT_RISK' | 'POOR' | 'NO_DATA' {
    if (value === null) return 'NO_DATA';
    if (t.higherIsBetter) return value >= t.good ? 'GOOD' : value >= t.risk ? 'AT_RISK' : 'POOR';
    return value <= t.good ? 'GOOD' : value <= t.risk ? 'AT_RISK' : 'POOR';
}

class SellerInsightsService {
    /** Account health over the last `days` days (Meesho-style quality metrics). */
    async health(sellerId: string, days = 30) {
        const since = addDays(new Date(), -days);
        const subOrders = await prisma.order.findMany({
            where: { createdAt: { gte: since }, status: { not: 'PLACED' }, items: { some: { sellerId } } },
            select: { id: true, createdAt: true, status: true, shipments: { where: { seller_id: sellerId } }, items: { where: { sellerId }, select: { quantity: true } } },
        });
        const total = subOrders.length;
        const [sellerCancels, returnQty, ratingAgg, ratingDist, penalties] = await Promise.all([
            prisma.sellerOrderCancellation.count({ where: { sellerId, createdAt: { gte: since } } }),
            prisma.returnItem.aggregate({
                where: { orderItem: { sellerId }, returnRequest: { createdAt: { gte: since }, status: { not: 'REJECTED' } } },
                _sum: { quantity: true },
            }),
            prisma.review.aggregate({ where: { product: { sellerId }, isHidden: false }, _avg: { rating: true }, _count: { _all: true } }),
            prisma.review.groupBy({ by: ['rating'], where: { product: { sellerId }, isHidden: false }, _count: { _all: true } }),
            prisma.sellerLedgerEntry.findMany({ where: { sellerId, type: 'PENALTY' }, orderBy: { createdAt: 'desc' }, take: 20 }),
        ]);

        const now = Date.now();
        const shipped = subOrders.filter((o) => o.shipments[0]?.shipped_at);
        const lateShipped = shipped.filter((o) => o.shipments[0]!.shipped_at! > dispatchBy(o.createdAt)).length;
        const overdue = subOrders.filter(
            (o) => o.status !== 'CANCELLED' && (!o.shipments[0] || o.shipments[0].status === 'CREATED') && dispatchBy(o.createdAt).getTime() < now
        ).length;
        const deliveredUnits = subOrders
            .filter((o) => o.shipments[0]?.status === 'DELIVERED')
            .reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0);
        const rto = subOrders.filter((o) => o.shipments[0]?.status?.startsWith('RTO')).length;

        const pct = (n: number, d: number) => (d > 0 ? round2((n / d) * 100) : null);
        const cancellationRate = pct(sellerCancels, total);
        const lateDispatchRate = pct(lateShipped + overdue, shipped.length + overdue);
        const returnRate = pct(returnQty._sum.quantity ?? 0, deliveredUnits);
        const rtoRate = pct(rto, shipped.length);
        const rating = ratingAgg._avg.rating ? round2(ratingAgg._avg.rating) : null;

        const metrics = [
            { key: 'cancellation', label: 'Seller cancellation rate', value: cancellationRate, unit: '%', target: 'Below 2%', status: band(cancellationRate, { good: 2, risk: 5 }) },
            { key: 'late_dispatch', label: 'Late dispatch rate', value: lateDispatchRate, unit: '%', target: `Below 5% (ship within ${DISPATCH_SLA_HOURS}h)`, status: band(lateDispatchRate, { good: 5, risk: 10 }) },
            { key: 'returns', label: 'Return rate', value: returnRate, unit: '%', target: 'Below 10%', status: band(returnRate, { good: 10, risk: 20 }) },
            { key: 'rto', label: 'RTO rate', value: rtoRate, unit: '%', target: 'Below 8%', status: band(rtoRate, { good: 8, risk: 15 }) },
            { key: 'rating', label: 'Average product rating', value: rating, unit: '★', target: '3.8 or higher', status: band(rating, { good: 3.8, risk: 3.3, higherIsBetter: true }) },
        ];

        let score = 100;
        score -= Math.min(30, (cancellationRate ?? 0) * 5);
        score -= Math.min(25, (lateDispatchRate ?? 0) * 2);
        score -= Math.min(20, (returnRate ?? 0) * 0.8);
        score -= Math.min(10, (rtoRate ?? 0) * 0.6);
        score -= rating === null ? 0 : Math.min(15, Math.max(0, (4.2 - rating) * 15));
        score = Math.round(Math.max(0, score));
        const poor = metrics.filter((m) => m.status === 'POOR').length;
        const status = total === 0 ? 'NEW' : poor > 0 || score < 60 ? 'POOR' : metrics.some((m) => m.status === 'AT_RISK') || score < 80 ? 'AT_RISK' : 'GOOD';

        const tips: string[] = [];
        if ((cancellationRate ?? 0) > 2) tips.push('Keep stock updated in Inventory so you never have to cancel for "out of stock".');
        if ((lateDispatchRate ?? 0) > 5) tips.push(`Accept orders and hand them to the courier within ${DISPATCH_SLA_HOURS} hours.`);
        if ((returnRate ?? 0) > 10) tips.push('Use real product photos and accurate size charts to reduce returns.');
        if ((rtoRate ?? 0) > 8) tips.push('Verify COD orders and pack securely to cut RTOs.');
        if (rating !== null && rating < 3.8) tips.push('Read your low-rated reviews and fix quality or sizing issues.');
        if (overdue > 0) tips.push(`${overdue} order(s) are past their dispatch date. Ship them now from Orders.`);

        return {
            days,
            score,
            status,
            orders: total,
            overdueOrders: overdue,
            metrics,
            ratings: {
                average: rating,
                count: ratingAgg._count._all,
                distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: ratingDist.find((d) => d.rating === r)?._count._all ?? 0 })),
            },
            penalties: penalties.map((p) => ({ id: p.id, amount: p.amount, orderId: p.orderId, note: p.note, date: p.createdAt, settled: Boolean(p.settledAt) })),
            lateDispatchPenalty: await getLateDispatchPenalty(),
            tips,
        };
    }

    /** Business insights: trends, category mix, products to push or fix. */
    async business(sellerId: string, days = 30) {
        const now = new Date();
        const since = addDays(now, -days);
        const prevSince = addDays(since, -days);
        const validOrder = { status: { notIn: ['CANCELLED', 'PLACED'] as ('CANCELLED' | 'PLACED')[] } };

        const [current, previous] = await Promise.all([
            prisma.orderItem.findMany({ where: { sellerId, order: { ...validOrder, createdAt: { gte: since } } }, select: { productId: true, variantId: true, quantity: true, sellerPriceSnapshot: true, orderId: true } }),
            prisma.orderItem.findMany({ where: { sellerId, order: { ...validOrder, createdAt: { gte: prevSince, lt: since } } }, select: { productId: true, quantity: true, sellerPriceSnapshot: true, orderId: true } }),
        ]);
        const revenue = (rows: { quantity: number; sellerPriceSnapshot: number }[]) => round2(rows.reduce((s, r) => s + r.quantity * r.sellerPriceSnapshot, 0));
        const orders = (rows: { orderId: string }[]) => new Set(rows.map((r) => r.orderId)).size;
        const units = (rows: { quantity: number }[]) => rows.reduce((s, r) => s + r.quantity, 0);

        const summary = {
            revenue: revenue(current),
            revenueChange: pctChange(revenue(current), revenue(previous)),
            orders: orders(current),
            ordersChange: pctChange(orders(current), orders(previous)),
            units: units(current),
            unitsChange: pctChange(units(current), units(previous)),
            avgOrderValue: orders(current) ? round2(revenue(current) / orders(current)) : 0,
        };

        // Products: sales now vs before, stock, wishlist demand.
        const products = await prisma.product.findMany({
            where: { sellerId, deletedByAdmin: false },
            select: {
                id: true, title: true, images: true, isPublished: true, status: true, createdAt: true,
                category: { select: { id: true, name: true } },
                variants: { select: { id: true, price: true, inventory: { select: { stock: true } } } },
                _count: { select: { wishlistItems: true, reviews: true } },
            },
        });
        const salesBy = (rows: { productId: string; quantity: number; sellerPriceSnapshot: number }[]) => {
            const m = new Map<string, { units: number; revenue: number }>();
            rows.forEach((r) => {
                const cur = m.get(r.productId) ?? { units: 0, revenue: 0 };
                cur.units += r.quantity;
                cur.revenue = round2(cur.revenue + r.quantity * r.sellerPriceSnapshot);
                m.set(r.productId, cur);
            });
            return m;
        };
        const now30 = salesBy(current);
        const prev30 = salesBy(previous as never);

        const rows = products.map((p) => {
            const stock = p.variants.reduce((s, v) => s + (v.inventory?.stock ?? 0), 0);
            const sale = now30.get(p.id) ?? { units: 0, revenue: 0 };
            const before = prev30.get(p.id) ?? { units: 0, revenue: 0 };
            const dailyRate = sale.units / days;
            return {
                productId: p.id,
                title: p.title,
                image: p.images[0] ?? null,
                category: p.category.name,
                live: p.isPublished,
                stock,
                units: sale.units,
                revenue: sale.revenue,
                unitsChange: pctChange(sale.units, before.units),
                wishlisted: p._count.wishlistItems,
                reviews: p._count.reviews,
                daysOfCover: dailyRate > 0 ? Math.floor(stock / dailyRate) : null,
                ageDays: Math.floor((now.getTime() - p.createdAt.getTime()) / 86_400_000),
            };
        });

        const topProducts = [...rows].filter((r) => r.units > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        const restock = rows
            .filter((r) => r.live && r.units > 0 && (r.stock <= LOW_STOCK_THRESHOLD || (r.daysOfCover !== null && r.daysOfCover < 14)))
            .sort((a, b) => (a.daysOfCover ?? 0) - (b.daysOfCover ?? 0))
            .slice(0, 10);
        const notSelling = rows.filter((r) => r.live && r.units === 0 && r.ageDays >= 14).slice(0, 10);
        const highDemand = rows.filter((r) => r.wishlisted >= 3 && r.stock <= LOW_STOCK_THRESHOLD).slice(0, 10);

        const categoryMap = new Map<string, { category: string; units: number; revenue: number }>();
        rows.forEach((r) => {
            const cur = categoryMap.get(r.category) ?? { category: r.category, units: 0, revenue: 0 };
            cur.units += r.units;
            cur.revenue = round2(cur.revenue + r.revenue);
            categoryMap.set(r.category, cur);
        });

        // Daily trend for the chart.
        const trendItems = await prisma.orderItem.findMany({
            where: { sellerId, order: { ...validOrder, createdAt: { gte: since } } },
            select: { quantity: true, sellerPriceSnapshot: true, order: { select: { createdAt: true } } },
        });
        const trend = Array.from({ length: days }, (_, i) => {
            const day = utcDay(addDays(now, -days + 1 + i));
            const next = addDays(day, 1);
            const inDay = trendItems.filter((t) => t.order.createdAt >= day && t.order.createdAt < next);
            return { date: day, revenue: revenue(inDay), units: units(inDay) };
        });

        const recommendations: { title: string; detail: string; action: string; href: string }[] = [];
        if (restock.length) recommendations.push({ title: `Restock ${restock.length} fast-moving product(s)`, detail: 'These will sell out within two weeks at the current rate.', action: 'Update stock', href: '/seller/inventory?filter=low_stock' });
        if (notSelling.length) recommendations.push({ title: `${notSelling.length} live product(s) have no sales`, detail: 'Try a price cut, a limited-time offer or better photos.', action: 'Check pricing', href: '/seller/pricing' });
        if (highDemand.length) recommendations.push({ title: 'Wishlisted products are low on stock', detail: 'Customers saved these items. Add stock before they buy elsewhere.', action: 'Open inventory', href: '/seller/inventory' });
        if (topProducts.length) recommendations.push({ title: 'Promote your bestsellers', detail: 'Ads on products that already sell bring the best return.', action: 'Create ad campaign', href: '/seller/ads' });

        return {
            days,
            summary,
            trend,
            categories: [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue),
            topProducts,
            restock,
            notSelling,
            highDemand,
            recommendations,
        };
    }

    /**
     * Record a penalty for each sub-order shipped after its dispatch date.
     * Charges only when an admin has set a penalty amount (> 0).
     */
    async runLateDispatchPenalties() {
        const amount = await getLateDispatchPenalty();
        if (amount <= 0) return { created: 0 };
        const since = addDays(new Date(), -14);
        const shipments = await prisma.shipments.findMany({
            where: { shipped_at: { gte: since } },
            select: { seller_id: true, order_id: true, shipped_at: true, orders: { select: { createdAt: true } } },
        });
        let created = 0;
        for (const s of shipments) {
            if (!s.shipped_at || s.shipped_at <= dispatchBy(s.orders.createdAt)) continue;
            const day = utcDay(s.shipped_at);
            const exists = await prisma.sellerLedgerEntry.findFirst({ where: { sellerId: s.seller_id, type: 'PENALTY', referenceId: s.order_id } });
            if (exists) continue;
            await prisma.sellerLedgerEntry.create({
                data: { sellerId: s.seller_id, type: 'PENALTY', amount: -amount, referenceId: s.order_id, orderId: s.order_id, entryDate: day, note: 'Late dispatch penalty' },
            });
            created += 1;
        }
        if (created) log.info({ created }, 'Late dispatch penalties recorded');
        return { created };
    }
}

export const sellerInsightsService = new SellerInsightsService();
