/**
 * Admin operations dashboard, ads oversight and seller announcements.
 */

import { AnnouncementLevel, Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { addDays, addHours, pctChange, round2, sellerCode, utcDay } from '../seller-center/common.js';
import { adminPayoutsService } from './payouts.service.js';
import { storeNames } from './penalties.service.js';

class AdminOpsService {
    async dashboard(rangeDays = 30) {
        const days = [7, 30, 90].includes(rangeDays) ? rangeDays : 30;
        const now = new Date();
        const since = addDays(now, -days);
        const prevSince = addDays(since, -days);

        const gmvRows = (from: Date, to: Date) => prisma.$queryRaw<{ orders: bigint; gmv: number; margin: number }[]>`
            SELECT COUNT(DISTINCT o."id") AS orders,
                   COALESCE(SUM(oi."price_snapshot" * oi."quantity"), 0) AS gmv,
                   COALESCE(SUM((oi."price_snapshot" - oi."seller_price_snapshot") * oi."quantity"), 0) AS margin
            FROM "orders" o JOIN "order_items" oi ON oi."order_id" = o."id"
            WHERE o."created_at" >= ${from} AND o."created_at" < ${to} AND o."status" NOT IN ('PLACED', 'CANCELLED')`;

        const [cur, prev, series, commission, adSpend, sellers, pendingSellers, kycReview, qcPending, liveProducts, openClaims, returnsRequested, cancelRequests, slaBreaches, topSellers, topCategories, recentOrders, payouts] =
            await Promise.all([
                gmvRows(since, now),
                gmvRows(prevSince, since),
                prisma.$queryRaw<{ day: Date; orders: bigint; gmv: number }[]>`
                    SELECT date_trunc('day', o."created_at") AS day, COUNT(DISTINCT o."id") AS orders, COALESCE(SUM(oi."price_snapshot" * oi."quantity"), 0) AS gmv
                    FROM "orders" o JOIN "order_items" oi ON oi."order_id" = o."id"
                    WHERE o."created_at" >= ${since} AND o."status" NOT IN ('PLACED', 'CANCELLED')
                    GROUP BY 1 ORDER BY 1`,
                prisma.sellerSettlement.aggregate({ where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } }, _sum: { commissionAmount: true, platformFee: true } }),
                prisma.adDailyStat.aggregate({ where: { date: { gte: utcDay(since) } }, _sum: { spend: true } }),
                prisma.user.groupBy({ by: ['status'], where: { role: 'SELLER' }, _count: { _all: true } }),
                prisma.user.count({ where: { role: 'SELLER', status: 'PENDING' } }),
                prisma.seller_profiles.count({ where: { kyc_status: 'PENDING', pan_number: { not: null } } }),
                prisma.product.count({ where: { deletedByAdmin: false, OR: [{ status: 'PENDING' }, { variants: { some: { status: 'PENDING' } } }] } }),
                prisma.product.count({ where: { isPublished: true, deletedByAdmin: false } }),
                prisma.sellerClaim.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
                prisma.returnRequest.count({ where: { status: 'REQUESTED' } }),
                prisma.cancellationRequest.count({ where: { status: 'REQUESTED' } }),
                prisma.order.count({ where: { status: 'CONFIRMED', createdAt: { lt: addHours(now, -48) } } }),
                prisma.$queryRaw<{ seller_id: string; orders: bigint; gmv: number }[]>`
                    SELECT oi."seller_id", COUNT(DISTINCT oi."order_id") AS orders, COALESCE(SUM(oi."price_snapshot" * oi."quantity"), 0) AS gmv
                    FROM "order_items" oi JOIN "orders" o ON o."id" = oi."order_id"
                    WHERE o."created_at" >= ${since} AND o."status" NOT IN ('PLACED', 'CANCELLED')
                    GROUP BY 1 ORDER BY gmv DESC LIMIT 5`,
                prisma.$queryRaw<{ name: string; units: bigint; gmv: number }[]>`
                    SELECT c."name", SUM(oi."quantity") AS units, COALESCE(SUM(oi."price_snapshot" * oi."quantity"), 0) AS gmv
                    FROM "order_items" oi JOIN "orders" o ON o."id" = oi."order_id"
                    JOIN "products" p ON p."id" = oi."product_id" JOIN "categories" c ON c."id" = p."category_id"
                    WHERE o."created_at" >= ${since} AND o."status" NOT IN ('PLACED', 'CANCELLED')
                    GROUP BY 1 ORDER BY gmv DESC LIMIT 5`,
                prisma.order.findMany({
                    where: { status: { not: 'PLACED' } },
                    orderBy: { createdAt: 'desc' },
                    take: 8,
                    select: { id: true, createdAt: true, status: true, grandTotal: true, totalAmount: true, shippingName: true, shippingCity: true, items: { select: { sellerId: true, quantity: true } } },
                }),
                adminPayoutsService.dueSummary(),
            ]);

        const c = cur[0];
        const p = prev[0];
        const gmv = round2(Number(c?.gmv ?? 0));
        const orders = Number(c?.orders ?? 0);
        const names = await storeNames([...topSellers.map((t) => t.seller_id), ...recentOrders.flatMap((o) => o.items.map((i) => i.sellerId))]);

        const sellerCounts = Object.fromEntries(sellers.map((s) => [s.status, s._count._all]));
        const byDay = new Map(series.map((s) => [new Date(s.day).toISOString().slice(0, 10), s]));
        return {
            rangeDays: days,
            kpis: {
                gmv: { value: gmv, change: pctChange(gmv, Number(p?.gmv ?? 0)) },
                orders: { value: orders, change: pctChange(orders, Number(p?.orders ?? 0)) },
                aov: orders ? round2(gmv / orders) : 0,
                platformRevenue: round2((commission._sum.commissionAmount ?? 0) + (commission._sum.platformFee ?? 0) + (adSpend._sum.spend ?? 0) + Number(c?.margin ?? 0)),
                commission: round2(commission._sum.commissionAmount ?? 0),
                adRevenue: round2(adSpend._sum.spend ?? 0),
                activeSellers: sellerCounts.ACTIVE ?? 0,
                liveProducts,
            },
            series: Array.from({ length: days }, (_, i) => {
                const d = addDays(utcDay(now), -days + 1 + i).toISOString().slice(0, 10);
                const row = byDay.get(d);
                return { date: d, gmv: round2(Number(row?.gmv ?? 0)), orders: Number(row?.orders ?? 0) };
            }),
            actionCenter: [
                { key: 'sellers', label: 'Sellers waiting for approval', count: pendingSellers, href: '/admin/sellers?tab=pending' },
                { key: 'kyc', label: 'KYC to verify', count: kycReview, href: '/admin/sellers?tab=kyc_review' },
                { key: 'qc', label: 'Products in QC', count: qcPending, href: '/admin/catalog-qc' },
                { key: 'sla', label: 'Orders past dispatch date', count: slaBreaches, href: '/admin/sla' },
                { key: 'cancellations', label: 'Cancellation requests', count: cancelRequests, href: '/admin/cancellations' },
                { key: 'returns', label: 'Return requests', count: returnsRequested, href: '/admin/returns' },
                { key: 'claims', label: 'Seller claims', count: openClaims, href: '/admin/seller-claims' },
                { key: 'payouts', label: 'Sellers to pay', count: payouts.totals.payableSellers, href: '/admin/payouts' },
            ],
            payoutsDue: payouts.totals,
            sellerCounts,
            topSellers: topSellers.map((t) => ({ sellerId: t.seller_id, code: sellerCode(t.seller_id), storeName: names.get(t.seller_id) ?? null, orders: Number(t.orders), gmv: round2(Number(t.gmv)) })),
            topCategories: topCategories.map((t) => ({ name: t.name, units: Number(t.units), gmv: round2(Number(t.gmv)) })),
            recentOrders: recentOrders.map((o) => ({
                id: o.id,
                createdAt: o.createdAt,
                status: o.status,
                amount: o.grandTotal || o.totalAmount,
                customer: o.shippingName,
                city: o.shippingCity,
                sellers: [...new Set(o.items.map((i) => names.get(i.sellerId) ?? sellerCode(i.sellerId)))],
            })),
        };
    }

    // ── Ads oversight ───────────────────────────────────────────────────────

    async ads(days = 30) {
        const since = utcDay(addDays(new Date(), -days + 1));
        const campaigns = await prisma.adCampaign.findMany({
            include: { products: true, stats: { where: { date: { gte: since } } } },
            orderBy: { createdAt: 'desc' },
            take: 300,
        });
        const names = await storeNames(campaigns.map((c) => c.sellerId));
        const rows = campaigns.map((c) => {
            const t = c.stats.reduce((a, s) => ({ impressions: a.impressions + s.impressions, clicks: a.clicks + s.clicks, spend: a.spend + s.spend, orders: a.orders + s.orders, revenue: a.revenue + s.revenue }), { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 });
            return { id: c.id, name: c.name, status: c.status, sellerId: c.sellerId, storeName: names.get(c.sellerId) ?? null, dailyBudget: c.dailyBudget, bidPerClick: c.bidPerClick, products: c.products.length, ...t, spend: round2(t.spend), revenue: round2(t.revenue) };
        });
        const totals = rows.reduce((a, r) => ({ impressions: a.impressions + r.impressions, clicks: a.clicks + r.clicks, spend: round2(a.spend + r.spend), orders: a.orders + r.orders, revenue: round2(a.revenue + r.revenue) }), { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 });
        return { days, totals: { ...totals, activeCampaigns: rows.filter((r) => r.status === 'ACTIVE').length }, campaigns: rows };
    }

    async setAdStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'ENDED') {
        const c = await prisma.adCampaign.findUnique({ where: { id } });
        if (!c) throw ApiError.notFound('Campaign not found');
        return prisma.adCampaign.update({ where: { id }, data: { status } });
    }

    // ── Announcements ───────────────────────────────────────────────────────

    async listAnnouncements() {
        return { announcements: await prisma.sellerAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }) };
    }

    async saveAnnouncement(
        adminId: string,
        id: string | null,
        input: { title: string; body: string; level: AnnouncementLevel; linkUrl?: string | null | undefined; linkLabel?: string | null | undefined; startsAt?: Date | undefined; endsAt?: Date | null | undefined; isActive?: boolean | undefined }
    ) {
        const data = {
            title: input.title,
            body: input.body,
            level: input.level,
            linkUrl: input.linkUrl ?? null,
            linkLabel: input.linkLabel ?? null,
            startsAt: input.startsAt ?? new Date(),
            endsAt: input.endsAt ?? null,
            isActive: input.isActive ?? true,
        };
        if (id) return prisma.sellerAnnouncement.update({ where: { id }, data });
        return prisma.sellerAnnouncement.create({ data: { ...data, createdBy: adminId } });
    }

    async deleteAnnouncement(id: string) {
        await prisma.sellerAnnouncement.delete({ where: { id } });
        return { deleted: true };
    }

    /** Live announcements for the seller dashboard. */
    async activeAnnouncements() {
        const now = new Date();
        const where: Prisma.SellerAnnouncementWhereInput = { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
        return prisma.sellerAnnouncement.findMany({ where, orderBy: { startsAt: 'desc' }, take: 5 });
    }
}

export const adminOpsService = new AdminOpsService();
