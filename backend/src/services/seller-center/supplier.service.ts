/**
 * Meesho supplier-panel screens that read across modules: Home (to-do list,
 * business insights), Dispatch Performance, Returns overview, Reduce RTO &
 * Returns (prepaid discount + WDRP), Product Quality and product view tracking.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { invalidateProductCaches, invalidateSellerPrivateCaches } from '../../utils/cache.util.js';
import { DISPATCH_SLA_HOURS, LOW_STOCK_THRESHOLD, addDays, dispatchBy, pctChange, round2, utcDay } from './common.js';
import { sellerOrdersService } from './orders.service.js';
import { adminOpsService } from '../admin-center/ops.service.js';

const pct = (n: number, d: number) => (d > 0 ? round2((n / d) * 100) : 0);

/** Quality bands on the share of 1–2★ ratings (Meesho: green/yellow/red/blocked). */
const QUALITY_BANDS = [
    { key: 'GREEN', label: 'Green', max: 15, visibility: '1.6X views' },
    { key: 'YELLOW', label: 'Yellow', max: 22, visibility: '1X views' },
    { key: 'RED', label: 'Red', max: 25, visibility: '0.6X views' },
    { key: 'BLOCKED', label: 'Blocked', max: Infinity, visibility: 'No views' },
] as const;
const MIN_RATINGS_FOR_SCORE = 5;

function qualityBand(lowPct: number | null) {
    if (lowPct === null) return null;
    return QUALITY_BANDS.find((b) => lowPct <= b.max)!.key;
}

type ShipmentLite = { status: string; shipped_at: Date | null; rto_initiated_at: Date | null };

class SellerSupplierService {
    // ── Product views ────────────────────────────────────────────────────────

    /** Fire-and-forget from the public product page. */
    async recordView(idOrSlug: string) {
        const product = await prisma.product.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, select: { id: true, sellerId: true } });
        if (!product) return;
        const productId = product.id;
        const day = utcDay();
        await prisma.productViewDaily.upsert({
            where: { productId_day: { productId, day } },
            create: { productId, sellerId: product.sellerId, day, views: 1 },
            update: { views: { increment: 1 } },
        });
    }

    // ── Home ────────────────────────────────────────────────────────────────

    async home(sellerId: string, range: 'daily' | 'weekly' | 'monthly' = 'daily') {
        const now = new Date();
        const bucketDays = range === 'monthly' ? 30 : range === 'weekly' ? 7 : 1;
        const buckets = 7;
        const since = utcDay(addDays(now, -(bucketDays * buckets) + 1));
        const liveVariants = { product: { sellerId, deletedByAdmin: false, isPublished: true } };

        const [profile, counts, outOfStock, lowStock, views, items, rto, priceSuggestions, announcements, hasBank, products] = await Promise.all([
            prisma.seller_profiles.findUnique({ where: { user_id: sellerId } }),
            sellerOrdersService.counts(sellerId),
            prisma.productVariant.count({ where: { ...liveVariants, OR: [{ inventory: null }, { inventory: { stock: { lte: 0 } } }] } }),
            prisma.productVariant.count({ where: { ...liveVariants, inventory: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } } }),
            prisma.productViewDaily.findMany({ where: { sellerId, day: { gte: since } }, select: { day: true, views: true } }),
            prisma.orderItem.findMany({
                where: { sellerId, order: { status: { notIn: ['PLACED'] }, createdAt: { gte: since } } },
                select: { orderId: true, order: { select: { createdAt: true } } },
            }),
            this.rtoAndReturnRates(sellerId, 90),
            this.priceSuggestionCount(sellerId),
            adminOpsService.activeAnnouncements(),
            prisma.seller_bank_accounts.count({ where: { seller_id: sellerId } }),
            prisma.product.count({ where: { sellerId } }),
        ]);

        const series = Array.from({ length: buckets }, (_, i) => {
            const start = utcDay(addDays(since, i * bucketDays));
            const end = addDays(start, bucketDays);
            return {
                start,
                end: addDays(end, -1),
                views: views.filter((v) => v.day >= start && v.day < end).reduce((s, v) => s + v.views, 0),
                orders: new Set(items.filter((r) => r.order.createdAt >= start && r.order.createdAt < end).map((r) => r.orderId)).size,
            };
        });
        const last = series[series.length - 1]!;
        const prev = series[series.length - 2]!;

        const setup = [
            { key: 'store', label: 'Add store name', done: Boolean(profile?.store_name), href: '/seller/settings' },
            { key: 'gst', label: 'Add GST / enrolment ID', done: Boolean(profile?.gstin || profile?.gst_number || profile?.enrolment_id), href: '/seller/settings?tab=business' },
            { key: 'pickup', label: 'Add pickup address', done: Boolean(profile?.pickup_pincode), href: '/seller/settings?tab=pickup' },
            { key: 'bank', label: 'Add bank details', done: hasBank > 0, href: '/seller/settings?tab=bank' },
            { key: 'catalog', label: 'Upload your first catalog', done: products > 0, href: '/seller/catalog-uploads' },
        ];

        return {
            storeName: profile?.store_name ?? null,
            todo: {
                pendingOrders: counts.pending,
                downloadLabels: counts.ready_to_ship,
                outOfStock,
                lowStock,
            },
            insights: {
                range,
                series,
                views: { value: last.views, change: pctChange(last.views, prev.views) },
                orders: { value: last.orders, change: pctChange(last.orders, prev.orders) },
            },
            rto,
            priceSuggestions,
            setup: setup.filter((s) => !s.done).length ? setup : [],
            announcements,
        };
    }

    private async priceSuggestionCount(sellerId: string) {
        const { sellerPricingService } = await import('./pricing.service.js');
        const list = await sellerPricingService.list(sellerId, { limit: 100 });
        return list.variants.filter((v) => v.recommendedSellerPrice != null).length;
    }

    /** COD vs prepaid RTO rate, and return rate overall vs with WDRP. */
    async rtoAndReturnRates(sellerId: string, days: number) {
        const since = addDays(new Date(), -days);
        const orders = await prisma.order.findMany({
            where: { createdAt: { gte: since }, items: { some: { sellerId } }, shipments: { some: { seller_id: sellerId, shipped_at: { not: null } } } },
            select: {
                payment: { select: { provider: true } },
                shipments: { where: { seller_id: sellerId }, select: { status: true, shipped_at: true, rto_initiated_at: true } },
                items: { where: { sellerId }, select: { variantId: true } },
            },
        });
        const isRto = (s: ShipmentLite[]) => s.some((x) => x.status.startsWith('RTO') || x.rto_initiated_at);
        const cod = orders.filter((o) => !o.payment || o.payment.provider === 'COD');
        const prepaid = orders.filter((o) => o.payment && o.payment.provider !== 'COD');

        const [delivered, returned, wdrpVariants] = await Promise.all([
            prisma.orderItem.aggregate({ where: { sellerId, order: { createdAt: { gte: since }, status: 'DELIVERED' } }, _sum: { quantity: true } }),
            prisma.returnItem.findMany({
                where: { orderItem: { sellerId }, returnRequest: { createdAt: { gte: since }, status: { not: 'REJECTED' } } },
                select: { quantity: true, variantId: true },
            }),
            prisma.productVariant.findMany({ where: { product: { sellerId }, wdrpPrice: { not: null } }, select: { id: true } }),
        ]);
        const wdrpSet = new Set(wdrpVariants.map((v) => v.id));
        const wdrpDelivered = await prisma.orderItem.aggregate({
            where: { sellerId, variantId: { in: [...wdrpSet] }, order: { createdAt: { gte: since }, status: 'DELIVERED' } },
            _sum: { quantity: true },
        });
        const returnedQty = returned.reduce((s, r) => s + r.quantity, 0);
        const wdrpReturned = returned.filter((r) => wdrpSet.has(r.variantId)).reduce((s, r) => s + r.quantity, 0);
        const [variantTotal, withPrepaid] = await Promise.all([
            prisma.product.count({ where: { sellerId, deletedByAdmin: false } }),
            prisma.product.count({ where: { sellerId, deletedByAdmin: false, variants: { some: { prepaidDiscount: { gt: 0 } } } } }),
        ]);
        const withWdrp = await prisma.product.count({ where: { sellerId, deletedByAdmin: false, variants: { some: { wdrpPrice: { not: null } } } } });

        return {
            days,
            codRto: pct(cod.filter((o) => isRto(o.shipments)).length, cod.length),
            prepaidRto: pct(prepaid.filter((o) => isRto(o.shipments)).length, prepaid.length),
            allReturns: pct(returnedQty, delivered._sum.quantity ?? 0),
            wdrpReturns: pct(wdrpReturned, wdrpDelivered._sum.quantity ?? 0),
            products: variantTotal,
            productsWithPrepaid: withPrepaid,
            productsWithWdrp: withWdrp,
        };
    }

    // ── Dispatch performance ────────────────────────────────────────────────

    async dispatchPerformance(sellerId: string, days = 30) {
        const since = addDays(new Date(), -days);
        const orders = await prisma.order.findMany({
            where: { createdAt: { gte: since }, status: { not: 'PLACED' }, items: { some: { sellerId } } },
            select: { id: true, createdAt: true, status: true, shipments: { where: { seller_id: sellerId }, select: { shipped_at: true, status: true } } },
            orderBy: { createdAt: 'asc' },
        });
        const now = Date.now();
        const cancelledBySeller = await prisma.sellerOrderCancellation.count({ where: { sellerId, createdAt: { gte: since } } });
        const shipped = orders.filter((o) => o.shipments[0]?.shipped_at);
        const onTime = shipped.filter((o) => o.shipments[0]!.shipped_at! <= dispatchBy(o.createdAt));
        const pendingBreached = orders.filter(
            (o) => o.status === 'CONFIRMED' && !o.shipments[0]?.shipped_at && dispatchBy(o.createdAt).getTime() < now
        );
        const hours = shipped.map((o) => (o.shipments[0]!.shipped_at!.getTime() - o.createdAt.getTime()) / 3_600_000);
        const sameDay = shipped.filter((o) => o.shipments[0]!.shipped_at!.toDateString() === o.createdAt.toDateString()).length;
        const nextDay = shipped.filter((o) => (o.shipments[0]!.shipped_at!.getTime() - o.createdAt.getTime()) / 3_600_000 <= 24).length;

        const weekly = Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
            const start = addDays(since, i * 7);
            const end = addDays(start, 7);
            const inWeek = shipped.filter((o) => o.createdAt >= start && o.createdAt < end);
            return {
                start,
                shipped: inWeek.length,
                onTimePct: inWeek.length ? pct(inWeek.filter((o) => o.shipments[0]!.shipped_at! <= dispatchBy(o.createdAt)).length, inWeek.length) : null,
            };
        });

        return {
            days,
            slaHours: DISPATCH_SLA_HOURS,
            totalOrders: orders.length,
            shipped: shipped.length,
            onTimeDispatchPct: shipped.length ? pct(onTime.length, shipped.length) : null,
            lateDispatched: shipped.length - onTime.length,
            pendingBreached: pendingBreached.length,
            avgDispatchHours: hours.length ? round2(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
            within24hPct: shipped.length ? pct(nextDay, shipped.length) : null,
            sameDayPct: shipped.length ? pct(sameDay, shipped.length) : null,
            sellerCancellationPct: orders.length ? pct(cancelledBySeller, orders.length) : null,
            weekly,
        };
    }

    // ── Returns overview ────────────────────────────────────────────────────

    async returnsOverview(sellerId: string, query: Record<string, unknown>) {
        const days = [30, 90, 180].includes(Number(query.days)) ? Number(query.days) : 30;
        const since = addDays(new Date(), -days);
        const categoryId = typeof query.categoryId === 'string' && query.categoryId ? query.categoryId : undefined;

        const [deliveredItems, returnedItems, shippedOrders, rtoOrders] = await Promise.all([
            prisma.orderItem.findMany({
                where: { sellerId, order: { status: 'DELIVERED', createdAt: { gte: since } } },
                select: { productId: true, quantity: true },
            }),
            prisma.returnItem.findMany({
                where: { orderItem: { sellerId }, returnRequest: { createdAt: { gte: since }, status: { not: 'REJECTED' } } },
                select: { quantity: true, reason: true, orderItem: { select: { productId: true } } },
            }),
            prisma.shipments.count({ where: { seller_id: sellerId, shipped_at: { gte: since } } }),
            prisma.shipments.count({ where: { seller_id: sellerId, shipped_at: { gte: since }, OR: [{ status: { in: ['RTO_INITIATED', 'RTO_DELIVERED'] } }, { rto_initiated_at: { not: null } }] } }),
        ]);
        const deliveredQty = deliveredItems.reduce((s, i) => s + i.quantity, 0);
        const returnedQty = returnedItems.reduce((s, i) => s + i.quantity, 0);

        const byProduct = new Map<string, { delivered: number; returned: number; reasons: Map<string, number> }>();
        for (const i of deliveredItems) {
            const row = byProduct.get(i.productId) ?? { delivered: 0, returned: 0, reasons: new Map() };
            row.delivered += i.quantity;
            byProduct.set(i.productId, row);
        }
        for (const r of returnedItems) {
            const row = byProduct.get(r.orderItem.productId) ?? { delivered: 0, returned: 0, reasons: new Map() };
            row.returned += r.quantity;
            const reason = r.reason?.trim() || 'Other';
            row.reasons.set(reason, (row.reasons.get(reason) ?? 0) + r.quantity);
            byProduct.set(r.orderItem.productId, row);
        }
        const products = await prisma.product.findMany({
            where: { sellerId, deletedByAdmin: false, ...(categoryId ? { categoryId } : {}) },
            select: { id: true, title: true, images: true, category: { select: { id: true, name: true } }, variants: { select: { wdrpPrice: true, prepaidDiscount: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        const sort = String(query.sort ?? 'recent');
        const rows = products.map((p) => {
            const stats = byProduct.get(p.id) ?? { delivered: 0, returned: 0, reasons: new Map<string, number>() };
            const topReason = [...stats.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
            return {
                id: p.id,
                title: p.title,
                image: p.images[0] ?? null,
                category: p.category,
                delivered: stats.delivered,
                returns: stats.returned,
                returnRate: pct(stats.returned, stats.delivered),
                topReason,
                wdrpEnabled: p.variants.some((v) => v.wdrpPrice != null),
                prepaidEnabled: p.variants.some((v) => (v.prepaidDiscount ?? 0) > 0),
            };
        });
        if (sort === 'returns') rows.sort((a, b) => b.returnRate - a.returnRate);
        if (sort === 'orders') rows.sort((a, b) => b.delivered - a.delivered);
        const filtered = query.performance === 'high_returns' ? rows.filter((r) => r.returnRate > 10) : rows;

        return {
            days,
            summary: {
                returnRate: pct(returnedQty, deliveredQty),
                returned: returnedQty,
                delivered: deliveredQty,
                // KTMONA absorbs reverse shipping today; kept for parity with the report.
                avgReverseShippingCost: 0,
                rtoRate: pct(rtoOrders, shippedOrders),
                rtoOrders,
                dispatched: shippedOrders,
            },
            products: filtered,
        };
    }

    // ── Reduce RTO & Returns ────────────────────────────────────────────────

    /** Discount groups: "All products" plus one row per category. */
    async rtoGroups(sellerId: string) {
        const [rates, products] = await Promise.all([
            this.rtoAndReturnRates(sellerId, 90),
            prisma.product.findMany({
                where: { sellerId, deletedByAdmin: false },
                select: {
                    id: true,
                    category: { select: { id: true, name: true, parent: { select: { name: true } } } },
                    variants: { select: { sellerPrice: true, wdrpPrice: true, prepaidDiscount: true } },
                },
            }),
        ]);
        type Group = { key: string; label: string; productIds: string[]; prices: number[]; prepaid: number[]; wdrpPct: number[] };
        const groups = new Map<string, Group>();
        const all: Group = { key: 'all', label: 'All Products', productIds: [], prices: [], prepaid: [], wdrpPct: [] };
        for (const p of products) {
            const key = p.category.id;
            const g = groups.get(key) ?? { key, label: p.category.parent ? `${p.category.parent.name} > ${p.category.name}` : p.category.name, productIds: [], prices: [], prepaid: [], wdrpPct: [] };
            for (const target of [g, all]) {
                target.productIds.push(p.id);
                p.variants.forEach((v) => {
                    target.prices.push(v.sellerPrice);
                    if (v.prepaidDiscount) target.prepaid.push(v.prepaidDiscount);
                    if (v.wdrpPrice != null) target.wdrpPct.push(v.sellerPrice - v.wdrpPrice);
                });
            }
            groups.set(key, g);
        }
        const shape = (g: Group) => ({
            key: g.key,
            label: g.label,
            products: g.productIds.length,
            priceMin: g.prices.length ? Math.min(...g.prices) : 0,
            priceMax: g.prices.length ? Math.max(...g.prices) : 0,
            prepaidDiscount: g.prepaid.length ? Math.max(...g.prepaid) : null,
            wdrpDiscount: g.wdrpPct.length ? Math.max(...g.wdrpPct) : null,
            applied: g.prepaid.length > 0 || g.wdrpPct.length > 0,
        });
        return { rates, groups: [shape(all), ...[...groups.values()].map(shape)] };
    }

    /**
     * Apply a flat prepaid discount and/or a WDRP discount (₹ below the price)
     * to every variant in the chosen groups. Pass 0 to remove.
     */
    async applyRtoDiscounts(sellerId: string, input: { groups: string[]; prepaidDiscount?: number | null | undefined; wdrpDiscount?: number | null | undefined }) {
        if (input.prepaidDiscount === undefined && input.wdrpDiscount === undefined) throw ApiError.badRequest('Enter a discount');
        const where: Prisma.ProductVariantWhereInput = {
            product: { sellerId, deletedByAdmin: false, ...(input.groups.includes('all') ? {} : { categoryId: { in: input.groups } }) },
        };
        const variants = await prisma.productVariant.findMany({ where, select: { id: true, sellerPrice: true, productId: true } });
        if (variants.length === 0) throw ApiError.notFound('No products in the selected groups');
        let skipped = 0;
        for (const v of variants) {
            const data: Prisma.ProductVariantUpdateInput = {};
            if (input.prepaidDiscount !== undefined) {
                const d = input.prepaidDiscount ?? 0;
                if (d >= v.sellerPrice * 0.5) {
                    skipped += 1;
                    continue;
                }
                data.prepaidDiscount = d > 0 ? d : null;
            }
            if (input.wdrpDiscount !== undefined) {
                const d = input.wdrpDiscount ?? 0;
                if (d >= v.sellerPrice * 0.5) {
                    skipped += 1;
                    continue;
                }
                data.wdrpPrice = d > 0 ? round2(v.sellerPrice - d) : null;
            }
            await prisma.productVariant.update({ where: { id: v.id }, data });
        }
        await invalidateProductCaches();
        await invalidateSellerPrivateCaches(sellerId);
        return { updated: variants.length - skipped, skipped };
    }

    // ── Quality ─────────────────────────────────────────────────────────────

    async quality(sellerId: string, query: Record<string, unknown>) {
        const tab = ['blocking_soon', 'action_pending', 'fixed'].includes(String(query.tab)) ? String(query.tab) : 'action_pending';
        const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
        const since = addDays(new Date(), -90);
        const [agg, low, products, feedback] = await Promise.all([
            prisma.review.count({ where: { product: { sellerId }, isHidden: false, createdAt: { gte: since } } }),
            prisma.review.count({ where: { product: { sellerId }, isHidden: false, createdAt: { gte: since }, rating: { lte: 2 } } }),
            prisma.product.findMany({
                where: { sellerId, deletedByAdmin: false },
                select: {
                    id: true, title: true, images: true, description: true, attributes: true, status: true, isPublished: true,
                    variants: { select: { sku: true, compareAtPrice: true, weightGrams: true } },
                    reviews: { where: { isHidden: false, createdAt: { gte: since } }, select: { rating: true, text: true, createdAt: true } },
                },
            }),
            prisma.review.findMany({
                where: { product: { sellerId }, isHidden: false, rating: { lte: 2 }, createdAt: { gte: since } },
                select: { text: true },
                take: 300,
            }),
        ]);
        const lowPct = agg >= MIN_RATINGS_FOR_SCORE ? pct(low, agg) : null;

        const rows = products.map((p) => {
            const total = p.reviews.length;
            const lows = p.reviews.filter((r) => r.rating <= 2);
            const productLowPct = total >= MIN_RATINGS_FOR_SCORE ? pct(lows.length, total) : null;
            const improvements: string[] = [];
            if (p.images.length < 3) improvements.push('Add at least 3 images (front, zoomed-in, table-top)');
            if (!p.description || p.description.length < 60) improvements.push('Write a fuller description (fabric, fit, care)');
            if (!p.attributes) improvements.push('Fill product attributes (colour, material, occasion)');
            if (p.variants.some((v) => !v.compareAtPrice)) improvements.push('Add MRP for every size');
            if (p.variants.some((v) => !v.weightGrams)) improvements.push('Add net weight');
            return {
                id: p.id,
                title: p.title,
                image: p.images[0] ?? null,
                sku: p.variants[0]?.sku ?? null,
                ratings: total,
                lowRatings: lows.length,
                lowPct: productLowPct,
                band: qualityBand(productLowPct),
                feedback: topThemes(lows.map((r) => r.text)),
                improvements,
                live: p.status === 'APPROVED' && p.isPublished,
            };
        });
        const blockingSoon = rows.filter((r) => r.band === 'RED' || r.band === 'BLOCKED');
        const actionPending = rows.filter((r) => r.improvements.length > 0 || r.band === 'YELLOW');
        const fixed = rows.filter((r) => r.improvements.length === 0 && (r.band === null || r.band === 'GREEN'));
        const pick = tab === 'blocking_soon' ? blockingSoon : tab === 'fixed' ? fixed : actionPending;
        const list = search ? pick.filter((r) => r.title.toLowerCase().includes(search) || r.sku?.toLowerCase().includes(search)) : pick;

        return {
            score: {
                totalRatings: agg,
                lowRatings: low,
                lowPct,
                band: qualityBand(lowPct),
                minRatings: MIN_RATINGS_FOR_SCORE,
            },
            bands: QUALITY_BANDS.map((b, i) => ({ key: b.key, label: b.label, visibility: b.visibility, from: i === 0 ? 0 : QUALITY_BANDS[i - 1]!.max, to: b.max === Infinity ? null : b.max })),
            topFeedback: topThemes(feedback.map((f) => f.text)),
            counts: { blocking_soon: blockingSoon.length, action_pending: actionPending.length, fixed: fixed.length },
            tab,
            products: list.slice(0, 100),
        };
    }
}

/** Most common complaint themes from 1–2★ review text. */
const THEMES: { label: string; words: RegExp }[] = [
    { label: 'Size / fit issue', words: /\b(size|fit|small|big|tight|loose|length)\b/i },
    { label: 'Poor quality', words: /\b(quality|cheap|thin|torn|tear|broke|broken|stitch)\b/i },
    { label: 'Different from photo', words: /\b(different|photo|image|picture|colou?r)\b/i },
    { label: 'Damaged product', words: /\b(damage|damaged|defect|defective|scratch)\b/i },
    { label: 'Wrong product', words: /\b(wrong|another|other product)\b/i },
    { label: 'Fabric / material', words: /\b(fabric|material|cloth|feel)\b/i },
];

function topThemes(texts: string[]) {
    const counts = THEMES.map((t) => ({ label: t.label, count: texts.filter((x) => t.words.test(x)).length })).filter((t) => t.count > 0);
    const total = counts.reduce((s, c) => s + c.count, 0);
    return counts.sort((a, b) => b.count - a.count).slice(0, 4).map((c) => ({ ...c, pct: pct(c.count, total) }));
}

export const sellerSupplierService = new SellerSupplierService();
