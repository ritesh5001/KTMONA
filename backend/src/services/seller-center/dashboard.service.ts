/**
 * Seller dashboard (home): stat cards, sales chart, order status, recent
 * orders, top sellers and action items.
 */

import { prisma } from '../../config/db.js';
import { LOW_STOCK_THRESHOLD, addDays, dispatchBy, pctChange, round2, sellerCode, utcDay } from './common.js';
import { sellerOrdersService } from './orders.service.js';
import { sellerPaymentsService } from './payments.service.js';

class SellerDashboardService {
    async overview(sellerId: string, rangeDays = 7) {
        const days = [7, 30, 90].includes(rangeDays) ? rangeDays : 7;
        const now = new Date();
        const since = addDays(now, -days);
        const prevSince = addDays(since, -days);
        const valid = { status: { notIn: ['CANCELLED', 'PLACED'] as ('CANCELLED' | 'PLACED')[] } };

        const [profile, user, curItems, prevItems, liveNow, liveAddedRecently, rating, counts, lowStock, openClaims, pendingCancels, payments] =
            await Promise.all([
                prisma.seller_profiles.findUnique({ where: { user_id: sellerId } }),
                prisma.user.findUnique({ where: { id: sellerId }, select: { email: true, phone: true, status: true } }),
                prisma.orderItem.findMany({
                    where: { sellerId, order: { ...valid, createdAt: { gte: since } } },
                    select: { orderId: true, quantity: true, sellerPriceSnapshot: true, order: { select: { createdAt: true } } },
                }),
                prisma.orderItem.findMany({
                    where: { sellerId, order: { ...valid, createdAt: { gte: prevSince, lt: since } } },
                    select: { orderId: true, quantity: true, sellerPriceSnapshot: true },
                }),
                prisma.product.count({ where: { sellerId, isPublished: true, deletedByAdmin: false } }),
                prisma.product.count({ where: { sellerId, isPublished: true, deletedByAdmin: false, approvedAt: { gte: since } } }),
                prisma.review.aggregate({ where: { product: { sellerId }, isHidden: false }, _avg: { rating: true }, _count: { _all: true } }),
                sellerOrdersService.counts(sellerId),
                prisma.productVariant.count({ where: { product: { sellerId, deletedByAdmin: false, isPublished: true }, inventory: { stock: { lte: LOW_STOCK_THRESHOLD } } } }),
                prisma.sellerClaim.count({ where: { sellerId, status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
                prisma.cancellationRequest.count({ where: { status: 'REQUESTED', order: { items: { some: { sellerId } } } } }),
                sellerPaymentsService.summary(sellerId),
            ]);

        const orderCount = (rows: { orderId: string }[]) => new Set(rows.map((r) => r.orderId)).size;
        const sales = (rows: { quantity: number; sellerPriceSnapshot: number }[]) => round2(rows.reduce((s, r) => s + r.quantity * r.sellerPriceSnapshot, 0));

        const series = Array.from({ length: days }, (_, i) => {
            const day = utcDay(addDays(now, -days + 1 + i));
            const next = addDays(day, 1);
            const inDay = curItems.filter((r) => r.order.createdAt >= day && r.order.createdAt < next);
            return { date: day, sales: sales(inDay), orders: orderCount(inDay) };
        });

        // Pending orders past their dispatch date.
        const pendingOrders = await prisma.order.findMany({
            where: { status: 'CONFIRMED', items: { some: { sellerId } }, shipments: { none: { seller_id: sellerId } } },
            select: { createdAt: true },
        });
        const breached = pendingOrders.filter((o) => dispatchBy(o.createdAt) < now).length;

        const [recent, top] = await Promise.all([
            sellerOrdersService.list(sellerId, { tab: 'all', limit: 5 }),
            this.topProducts(sellerId, since),
        ]);

        const checklist = [
            { key: 'store', label: 'Store name', done: Boolean(profile?.store_name), href: '/seller/settings' },
            { key: 'gst', label: 'GST / enrolment details', done: Boolean(profile?.gstin || profile?.gst_number || profile?.enrolment_id), href: '/seller/settings?tab=business' },
            { key: 'pickup', label: 'Pickup address', done: Boolean(profile?.pickup_pincode), href: '/seller/settings?tab=pickup' },
            { key: 'bank', label: 'Bank account for payouts', done: profile ? (await prisma.seller_bank_accounts.count({ where: { seller_id: sellerId } })) > 0 : false, href: '/seller/settings?tab=bank' },
            { key: 'product', label: 'List your first product', done: (await prisma.product.count({ where: { sellerId } })) > 0, href: '/seller/products/new' },
        ];

        const alerts: { tone: 'danger' | 'warning' | 'info'; text: string; href: string }[] = [];
        if (breached) alerts.push({ tone: 'danger', text: `${breached} order(s) are past their dispatch date`, href: '/seller/orders?tab=pending' });
        if (counts.pending) alerts.push({ tone: 'warning', text: `${counts.pending} new order(s) waiting to be accepted`, href: '/seller/orders?tab=pending' });
        if (pendingCancels) alerts.push({ tone: 'warning', text: `${pendingCancels} cancellation request(s) from customers`, href: '/seller/orders?tab=pending' });
        if (lowStock) alerts.push({ tone: 'info', text: `${lowStock} variant(s) are low on stock`, href: '/seller/inventory?filter=low_stock' });
        if (openClaims) alerts.push({ tone: 'info', text: `${openClaims} claim(s) under review`, href: '/seller/returns?view=claims' });
        if (profile?.vacation_mode) alerts.push({ tone: 'warning', text: 'Holiday mode is on. Your listings are hidden.', href: '/seller/settings' });

        return {
            seller: {
                id: sellerId,
                code: sellerCode(sellerId),
                storeName: profile?.store_name ?? null,
                storeLogo: profile?.store_logo ?? null,
                email: user?.email ?? null,
                phone: user?.phone ?? null,
                accountStatus: user?.status ?? null,
                kycStatus: profile?.kyc_status ?? 'PENDING',
                vacationMode: profile?.vacation_mode ?? false,
            },
            rangeDays: days,
            stats: {
                totalOrders: { value: orderCount(curItems), change: pctChange(orderCount(curItems), orderCount(prevItems)) },
                totalSales: { value: sales(curItems), change: pctChange(sales(curItems), sales(prevItems)) },
                activeProducts: { value: liveNow, addedInRange: liveAddedRecently },
                rating: { value: rating._avg.rating ? round2(rating._avg.rating) : null, reviews: rating._count._all },
            },
            series,
            orderStatus: {
                pending: counts.pending,
                readyToShip: counts.ready_to_ship,
                shipped: counts.shipped,
                delivered: counts.delivered,
                cancelled: counts.cancelled,
                rto: counts.rto,
            },
            recentOrders: recent.orders,
            topProducts: top,
            payments: { nextPayout: payments.nextPayout, upcoming: payments.upcoming, netPayable: payments.netPayable },
            checklist,
            alerts,
        };
    }

    private async topProducts(sellerId: string, since: Date) {
        const grouped = await prisma.orderItem.groupBy({
            by: ['productId'],
            where: { sellerId, order: { status: { notIn: ['CANCELLED', 'PLACED'] }, createdAt: { gte: since } } },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5,
        });
        let ids = grouped.map((g) => g.productId);
        let soldMap = new Map(grouped.map((g) => [g.productId, g._sum.quantity ?? 0]));
        if (ids.length === 0) {
            // No sales in range: show all-time best sellers instead.
            const allTime = await prisma.orderItem.groupBy({
                by: ['productId'],
                where: { sellerId, order: { status: { notIn: ['CANCELLED', 'PLACED'] } } },
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 5,
            });
            ids = allTime.map((g) => g.productId);
            soldMap = new Map(allTime.map((g) => [g.productId, g._sum.quantity ?? 0]));
        }
        const products = await prisma.product.findMany({
            where: { id: { in: ids } },
            select: { id: true, title: true, images: true, variants: { select: { price: true, sellerPrice: true }, orderBy: { price: 'asc' }, take: 1 } },
        });
        const pMap = new Map(products.map((p) => [p.id, p]));
        return ids
            .map((id) => pMap.get(id))
            .filter((p): p is NonNullable<typeof p> => Boolean(p))
            .map((p) => ({ id: p.id, title: p.title, image: p.images[0] ?? null, price: p.variants[0]?.price ?? null, sellerPrice: p.variants[0]?.sellerPrice ?? null, sold: soldMap.get(p.id) ?? 0 }));
    }
}

export const sellerDashboardService = new SellerDashboardService();
