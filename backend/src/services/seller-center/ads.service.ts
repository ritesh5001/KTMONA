/**
 * KTMONA Ads: sponsored products, cost-per-click with a daily budget cap.
 * Spend is rolled up daily into the seller ledger and deducted from payouts.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { addDays, compact, round2, utcDay } from './common.js';

export const MIN_BID = 1;
export const MIN_DAILY_BUDGET = 50;

class SellerAdsService {
    async listCampaigns(sellerId: string, query: Record<string, unknown>) {
        const days = Math.min(Math.max(Number(query.days) || 30, 1), 90);
        const since = utcDay(addDays(new Date(), -days + 1));
        const campaigns = await prisma.adCampaign.findMany({
            where: { sellerId },
            include: { products: true, stats: { where: { date: { gte: since } } } },
            orderBy: { createdAt: 'desc' },
        });
        const today = utcDay();
        const rows = campaigns.map((c) => {
            const t = c.stats.reduce(
                (acc, s) => ({
                    impressions: acc.impressions + s.impressions,
                    clicks: acc.clicks + s.clicks,
                    spend: acc.spend + s.spend,
                    orders: acc.orders + s.orders,
                    revenue: acc.revenue + s.revenue,
                }),
                { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 }
            );
            const spentToday = c.stats.filter((s) => s.date.getTime() === today.getTime()).reduce((sum, s) => sum + s.spend, 0);
            return {
                id: c.id,
                name: c.name,
                status: c.status,
                dailyBudget: c.dailyBudget,
                bidPerClick: c.bidPerClick,
                startsAt: c.startsAt,
                endsAt: c.endsAt,
                productCount: c.products.length,
                productIds: c.products.map((p) => p.productId),
                spentToday: round2(spentToday),
                ...t,
                spend: round2(t.spend),
                revenue: round2(t.revenue),
                ctr: t.impressions ? round2((t.clicks / t.impressions) * 100) : 0,
                roas: t.spend ? round2(t.revenue / t.spend) : 0,
            };
        });
        const totals = rows.reduce(
            (acc, r) => ({
                impressions: acc.impressions + r.impressions,
                clicks: acc.clicks + r.clicks,
                spend: round2(acc.spend + r.spend),
                orders: acc.orders + r.orders,
                revenue: round2(acc.revenue + r.revenue),
            }),
            { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 }
        );
        const daily = await prisma.adDailyStat.groupBy({
            by: ['date'],
            where: { campaign: { sellerId }, date: { gte: since } },
            _sum: { impressions: true, clicks: true, spend: true, orders: true },
            orderBy: { date: 'asc' },
        });
        return {
            days,
            minBid: MIN_BID,
            minDailyBudget: MIN_DAILY_BUDGET,
            totals: { ...totals, ctr: totals.impressions ? round2((totals.clicks / totals.impressions) * 100) : 0, roas: totals.spend ? round2(totals.revenue / totals.spend) : 0 },
            daily: daily.map((d) => ({
                date: d.date,
                impressions: d._sum.impressions ?? 0,
                clicks: d._sum.clicks ?? 0,
                spend: round2(d._sum.spend ?? 0),
                orders: d._sum.orders ?? 0,
            })),
            campaigns: rows,
        };
    }

    async createCampaign(
        sellerId: string,
        input: { name: string; dailyBudget: number; bidPerClick: number; startsAt?: Date | undefined; endsAt?: Date | null | undefined; productIds: string[] }
    ) {
        this.validate(input);
        const products = await prisma.product.findMany({
            where: { id: { in: input.productIds }, sellerId, isPublished: true, deletedByAdmin: false },
            select: { id: true },
        });
        if (products.length === 0) throw ApiError.badRequest('Pick at least one live product to advertise');
        return prisma.adCampaign.create({
            data: {
                sellerId,
                name: input.name,
                dailyBudget: input.dailyBudget,
                bidPerClick: input.bidPerClick,
                startsAt: input.startsAt ?? new Date(),
                endsAt: input.endsAt ?? null,
                products: { create: products.map((p) => ({ productId: p.id })) },
            },
        });
    }

    async updateCampaign(
        sellerId: string,
        id: string,
        input: { name?: string | undefined; dailyBudget?: number | undefined; bidPerClick?: number | undefined; endsAt?: Date | null | undefined; status?: 'ACTIVE' | 'PAUSED' | 'ENDED' | undefined; productIds?: string[] | undefined}
    ) {
        const campaign = await prisma.adCampaign.findFirst({ where: { id, sellerId } });
        if (!campaign) throw ApiError.notFound('Campaign not found');
        if (campaign.status === 'ENDED') throw ApiError.badRequest('This campaign has ended');
        this.validate({ dailyBudget: input.dailyBudget ?? campaign.dailyBudget, bidPerClick: input.bidPerClick ?? campaign.bidPerClick });

        return prisma.$transaction(async (tx) => {
            if (input.productIds) {
                const products = await tx.product.findMany({
                    where: { id: { in: input.productIds }, sellerId, deletedByAdmin: false },
                    select: { id: true },
                });
                await tx.adCampaignProduct.deleteMany({ where: { campaignId: id } });
                await tx.adCampaignProduct.createMany({ data: products.map((p) => ({ campaignId: id, productId: p.id })) });
            }
            return tx.adCampaign.update({
                where: { id },
                data: compact({
                    name: input.name,
                    dailyBudget: input.dailyBudget,
                    bidPerClick: input.bidPerClick,
                    endsAt: input.endsAt,
                    status: input.status,
                }),
            });
        });
    }

    private validate(input: { dailyBudget: number; bidPerClick: number }) {
        if (!(input.dailyBudget >= MIN_DAILY_BUDGET)) throw ApiError.badRequest(`Daily budget must be at least Rs. ${MIN_DAILY_BUDGET}`);
        if (!(input.bidPerClick >= MIN_BID)) throw ApiError.badRequest(`Cost per click must be at least Rs. ${MIN_BID}`);
        if (input.bidPerClick > input.dailyBudget) throw ApiError.badRequest('Cost per click cannot exceed the daily budget');
    }

    // ── Serving (public) ────────────────────────────────────────────────────

    /**
     * Pick sponsored products for a storefront slot. Highest bid first among
     * campaigns that still have budget today; records one impression each.
     */
    async sponsored(opts: { categoryId?: string | undefined; search?: string | undefined; limit?: number | undefined; excludeIds?: string[] | undefined}) {
        const limit = Math.min(opts.limit ?? 4, 12);
        const now = new Date();
        const today = utcDay(now);

        const campaigns = await prisma.adCampaign.findMany({
            where: {
                status: 'ACTIVE',
                startsAt: { lte: now },
                OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            },
            include: { products: true, stats: { where: { date: today } } },
            orderBy: { bidPerClick: 'desc' },
            take: 50,
        });

        const eligible = campaigns.filter((c) => c.stats.reduce((s, x) => s + x.spend, 0) + c.bidPerClick <= c.dailyBudget);
        const candidateIds = [...new Set(eligible.flatMap((c) => c.products.map((p) => p.productId)))].filter(
            (id) => !opts.excludeIds?.includes(id)
        );
        if (candidateIds.length === 0) return [];

        const productWhere: Prisma.ProductWhereInput = {
            id: { in: candidateIds },
            isPublished: true,
            deletedByAdmin: false,
            status: 'APPROVED',
            ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
            ...(opts.search ? { title: { contains: opts.search, mode: 'insensitive' } } : {}),
        };
        const products = await prisma.product.findMany({
            where: productWhere,
            include: {
                category: { select: { id: true, name: true } },
                variants: {
                    where: { status: 'APPROVED' },
                    select: { id: true, price: true, compareAtPrice: true, images: true, inventory: { select: { stock: true } } },
                    orderBy: { price: 'asc' },
                },
            },
        });
        const inStock = products.filter((p) => p.variants.some((v) => (v.inventory?.stock ?? 0) > 0));
        const productMap = new Map(inStock.map((p) => [p.id, p]));

        // Walk campaigns by bid, taking each product once.
        const picked: { campaignId: string; product: (typeof inStock)[number] }[] = [];
        for (const c of eligible) {
            for (const cp of c.products) {
                const product = productMap.get(cp.productId);
                if (product && !picked.some((p) => p.product.id === product.id)) picked.push({ campaignId: c.id, product });
                if (picked.length >= limit) break;
            }
            if (picked.length >= limit) break;
        }

        await Promise.all(
            picked.map((p) =>
                prisma.adDailyStat.upsert({
                    where: { campaignId_productId_date: { campaignId: p.campaignId, productId: p.product.id, date: today } },
                    create: { campaignId: p.campaignId, productId: p.product.id, date: today, impressions: 1 },
                    update: { impressions: { increment: 1 } },
                })
            )
        );

        return picked.map(({ campaignId, product }) => {
            const cheapest = product.variants[0];
            return {
                adCampaignId: campaignId,
                id: product.id,
                title: product.title,
                images: product.images.length ? product.images : cheapest?.images ?? [],
                category: product.category,
                price: cheapest?.price ?? null,
                compareAtPrice: cheapest?.compareAtPrice ?? null,
                sponsored: true,
            };
        });
    }

    /** Record a click and charge the bid (within today's budget). */
    async click(campaignId: string, productId: string) {
        const today = utcDay();
        const campaign = await prisma.adCampaign.findUnique({
            where: { id: campaignId },
            include: { stats: { where: { date: today } } },
        });
        if (!campaign || campaign.status !== 'ACTIVE') return { charged: 0 };
        const spentToday = campaign.stats.reduce((s, x) => s + x.spend, 0);
        const charge = spentToday + campaign.bidPerClick <= campaign.dailyBudget ? campaign.bidPerClick : 0;
        await prisma.adDailyStat.upsert({
            where: { campaignId_productId_date: { campaignId, productId, date: today } },
            create: { campaignId, productId, date: today, clicks: 1, spend: charge },
            update: { clicks: { increment: 1 }, spend: { increment: charge } },
        });
        return { charged: charge };
    }

    /**
     * Attribute an order to ads: any advertised product clicked in the last
     * 7 days that appears in the order counts as an ad order.
     */
    async attributeOrder(orderId: string) {
        const items = await prisma.orderItem.findMany({ where: { orderId } });
        const since = utcDay(addDays(new Date(), -7));
        const today = utcDay();
        for (const item of items) {
            const stat = await prisma.adDailyStat.findFirst({
                where: { productId: item.productId, clicks: { gt: 0 }, date: { gte: since }, campaign: { sellerId: item.sellerId } },
                orderBy: { date: 'desc' },
            });
            if (!stat) continue;
            await prisma.adDailyStat.upsert({
                where: { campaignId_productId_date: { campaignId: stat.campaignId, productId: item.productId, date: today } },
                create: { campaignId: stat.campaignId, productId: item.productId, date: today, orders: 1, revenue: item.priceSnapshot * item.quantity },
                update: { orders: { increment: 1 }, revenue: { increment: item.priceSnapshot * item.quantity } },
            });
        }
    }

    /** Roll ad spend into the ledger (one negative entry per campaign per day). */
    async rollupSpendToLedger() {
        const since = utcDay(addDays(new Date(), -3));
        const spend = await prisma.adDailyStat.groupBy({
            by: ['campaignId', 'date'],
            where: { date: { gte: since }, spend: { gt: 0 } },
            _sum: { spend: true },
        });
        if (spend.length === 0) return { entries: 0 };
        const campaigns = await prisma.adCampaign.findMany({
            where: { id: { in: [...new Set(spend.map((s) => s.campaignId))] } },
            select: { id: true, sellerId: true, name: true },
        });
        const cMap = new Map(campaigns.map((c) => [c.id, c]));
        for (const row of spend) {
            const c = cMap.get(row.campaignId);
            if (!c) continue;
            const amount = -round2(row._sum.spend ?? 0);
            await prisma.sellerLedgerEntry.upsert({
                where: { sellerId_type_referenceId_entryDate: { sellerId: c.sellerId, type: 'AD_SPEND', referenceId: c.id, entryDate: row.date } },
                create: { sellerId: c.sellerId, type: 'AD_SPEND', amount, referenceId: c.id, entryDate: row.date, note: `Ads: ${c.name}` },
                update: { amount },
            });
        }
        // End campaigns past their end date.
        await prisma.adCampaign.updateMany({ where: { status: { not: 'ENDED' }, endsAt: { lte: new Date() } }, data: { status: 'ENDED' } });
        return { entries: spend.length };
    }
}

export const sellerAdsService = new SellerAdsService();
