/**
 * Platform sale events (Meesho "Mega Blockbuster Sale" style). Sellers opt in
 * products at >= the event's minimum discount; each opt-in is a SellerOffer
 * tagged with the campaign, so the offer scheduler applies/reverts prices.
 */
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { sellerPricingService } from '../seller-center/pricing.service.js';
import { round2 } from '../seller-center/common.js';
function phase(c, now = new Date()) {
    if (c.status === 'DRAFT')
        return 'DRAFT';
    if (c.status === 'CANCELLED')
        return 'CANCELLED';
    if (c.endsAt <= now)
        return 'ENDED';
    if (c.startsAt <= now)
        return 'LIVE';
    return 'UPCOMING';
}
function canJoin(c, now = new Date()) {
    return c.status === 'PUBLISHED' && c.endsAt > now && (!c.joinDeadline || c.joinDeadline > now);
}
function slugify(v) {
    return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sale';
}
class CampaignsService {
    validate(input) {
        if (input.endsAt <= input.startsAt)
            throw ApiError.badRequest('End must be after start');
        if (input.minDiscountPercent < 1 || input.minDiscountPercent > 80)
            throw ApiError.badRequest('Minimum discount must be 1–80%');
        if (input.joinDeadline && input.joinDeadline > input.endsAt)
            throw ApiError.badRequest('Join deadline must be before the sale ends');
    }
    async stats(campaignIds) {
        const offers = await prisma.sellerOffer.findMany({
            where: { campaignId: { in: campaignIds }, status: { not: 'CANCELLED' } },
            include: { items: true },
        });
        const out = new Map();
        for (const id of campaignIds) {
            const mine = offers.filter((o) => o.campaignId === id);
            const variantIds = mine.flatMap((o) => o.items.map((i) => i.variantId));
            let units = 0;
            let gmv = 0;
            if (variantIds.length && mine[0]) {
                const sold = await prisma.orderItem.findMany({
                    where: { variantId: { in: variantIds }, order: { createdAt: { gte: mine[0].startsAt, lte: mine[0].endsAt }, status: { notIn: ['CANCELLED', 'PLACED'] } } },
                    select: { quantity: true, priceSnapshot: true },
                });
                units = sold.reduce((s, x) => s + x.quantity, 0);
                gmv = round2(sold.reduce((s, x) => s + x.quantity * x.priceSnapshot, 0));
            }
            out.set(id, {
                sellers: new Set(mine.map((o) => o.sellerId)).size,
                products: new Set(mine.flatMap((o) => o.items.map((i) => i.productId))).size,
                variants: variantIds.length,
                units,
                gmv,
            });
        }
        return out;
    }
    // ── Admin ───────────────────────────────────────────────────────────────
    async adminList() {
        const campaigns = await prisma.platformCampaign.findMany({ orderBy: { startsAt: 'desc' } });
        const stats = await this.stats(campaigns.map((c) => c.id));
        return { campaigns: campaigns.map((c) => ({ ...c, phase: phase(c), ...stats.get(c.id) })) };
    }
    async create(adminId, input) {
        this.validate(input);
        let slug = slugify(input.name);
        if (await prisma.platformCampaign.findUnique({ where: { slug } }))
            slug = `${slug}-${Date.now().toString(36)}`;
        return prisma.platformCampaign.create({
            data: {
                name: input.name,
                slug,
                description: input.description ?? null,
                bannerImage: input.bannerImage ?? null,
                startsAt: input.startsAt,
                endsAt: input.endsAt,
                joinDeadline: input.joinDeadline ?? null,
                minDiscountPercent: input.minDiscountPercent,
                categoryIds: input.categoryIds ?? [],
                createdBy: adminId,
            },
        });
    }
    async update(id, input) {
        const current = await prisma.platformCampaign.findUnique({ where: { id } });
        if (!current)
            throw ApiError.notFound('Sale event not found');
        if (current.status === 'CANCELLED')
            throw ApiError.badRequest('This sale event was cancelled');
        const merged = { ...current, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
        this.validate(merged);
        if (input.status === 'CANCELLED') {
            const offers = await prisma.sellerOffer.findMany({ where: { campaignId: id, status: { in: ['SCHEDULED', 'ACTIVE'] } } });
            for (const o of offers)
                await sellerPricingService.cancelOffer(o.sellerId, o.id);
        }
        const updated = await prisma.platformCampaign.update({
            where: { id },
            data: {
                name: input.name,
                description: input.description,
                bannerImage: input.bannerImage,
                startsAt: input.startsAt,
                endsAt: input.endsAt,
                joinDeadline: input.joinDeadline,
                minDiscountPercent: input.minDiscountPercent,
                categoryIds: input.categoryIds,
                status: input.status,
            },
        });
        // Keep participating offers in step with the event dates.
        if (input.startsAt || input.endsAt) {
            await prisma.sellerOffer.updateMany({ where: { campaignId: id, status: 'SCHEDULED' }, data: { startsAt: updated.startsAt, endsAt: updated.endsAt } });
            await prisma.sellerOffer.updateMany({ where: { campaignId: id, status: 'ACTIVE' }, data: { endsAt: updated.endsAt } });
        }
        return updated;
    }
    // ── Seller ──────────────────────────────────────────────────────────────
    async sellerList(sellerId) {
        const now = new Date();
        const campaigns = await prisma.platformCampaign.findMany({
            where: { status: 'PUBLISHED', endsAt: { gt: new Date(now.getTime() - 30 * 86_400_000) } },
            orderBy: { startsAt: 'asc' },
        });
        const mine = await prisma.sellerOffer.findMany({
            where: { sellerId, campaignId: { in: campaigns.map((c) => c.id) }, status: { not: 'CANCELLED' } },
            include: { items: true },
        });
        const categories = await prisma.category.findMany({ where: { id: { in: campaigns.flatMap((c) => c.categoryIds) } }, select: { id: true, name: true } });
        return {
            campaigns: campaigns.map((c) => {
                const offer = mine.find((o) => o.campaignId === c.id);
                return {
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    description: c.description,
                    bannerImage: c.bannerImage,
                    startsAt: c.startsAt,
                    endsAt: c.endsAt,
                    joinDeadline: c.joinDeadline,
                    minDiscountPercent: c.minDiscountPercent,
                    categories: categories.filter((x) => c.categoryIds.includes(x.id)),
                    phase: phase(c, now),
                    canJoin: canJoin(c, now),
                    participation: offer
                        ? { offerId: offer.id, discountPercent: offer.discountPercent, products: new Set(offer.items.map((i) => i.productId)).size, status: offer.status }
                        : null,
                };
            }),
        };
    }
    async join(sellerId, campaignId, input) {
        const c = await prisma.platformCampaign.findUnique({ where: { id: campaignId } });
        if (!c || c.status !== 'PUBLISHED')
            throw ApiError.notFound('Sale event not found');
        if (!canJoin(c))
            throw ApiError.badRequest('Joining for this sale event has closed');
        if (input.discountPercent < c.minDiscountPercent)
            throw ApiError.badRequest(`This sale needs at least ${c.minDiscountPercent}% off`);
        const existing = await prisma.sellerOffer.findFirst({ where: { sellerId, campaignId, status: { in: ['SCHEDULED', 'ACTIVE'] } } });
        if (existing)
            throw ApiError.conflict('You have already joined. Leave first to change products or discount.');
        let productIds = input.productIds;
        if (c.categoryIds.length) {
            const allowed = await prisma.product.findMany({ where: { id: { in: productIds }, sellerId, categoryId: { in: c.categoryIds } }, select: { id: true } });
            productIds = allowed.map((p) => p.id);
            if (productIds.length === 0)
                throw ApiError.badRequest('None of these products are in the sale categories');
        }
        const start = c.startsAt > new Date() ? c.startsAt : new Date();
        const res = await sellerPricingService.createOffer(sellerId, {
            name: c.name,
            discountPercent: input.discountPercent,
            startsAt: start,
            endsAt: c.endsAt,
            productIds,
        });
        await prisma.sellerOffer.update({ where: { id: res.offer.id }, data: { campaignId } });
        return { joined: true, skippedVariants: res.skippedVariants };
    }
    async leave(sellerId, campaignId) {
        const offer = await prisma.sellerOffer.findFirst({ where: { sellerId, campaignId, status: { in: ['SCHEDULED', 'ACTIVE'] } } });
        if (!offer)
            throw ApiError.notFound('You are not part of this sale event');
        await sellerPricingService.cancelOffer(sellerId, offer.id);
        return { left: true };
    }
    // ── Public ──────────────────────────────────────────────────────────────
    async publicList() {
        const now = new Date();
        const rows = await prisma.platformCampaign.findMany({
            where: { status: 'PUBLISHED', endsAt: { gt: now } },
            orderBy: { startsAt: 'asc' },
            select: { name: true, slug: true, description: true, bannerImage: true, startsAt: true, endsAt: true, minDiscountPercent: true },
        });
        return rows.map((r) => ({ ...r, live: r.startsAt <= now }));
    }
    async publicDetail(slug) {
        const c = await prisma.platformCampaign.findUnique({ where: { slug } });
        if (!c || c.status !== 'PUBLISHED')
            throw ApiError.notFound('Sale not found');
        const live = phase(c) === 'LIVE';
        const offers = live
            ? await prisma.sellerOffer.findMany({ where: { campaignId: c.id, status: 'ACTIVE' }, include: { items: true } })
            : [];
        const productIds = [...new Set(offers.flatMap((o) => o.items.map((i) => i.productId)))];
        const products = productIds.length
            ? await prisma.product.findMany({
                where: { id: { in: productIds }, isPublished: true, deletedByAdmin: false },
                include: {
                    category: { select: { id: true, name: true } },
                    variants: { where: { status: 'APPROVED' }, select: { price: true, compareAtPrice: true, images: true }, orderBy: { price: 'asc' }, take: 1 },
                },
                take: 120,
            })
            : [];
        return {
            campaign: { name: c.name, slug: c.slug, description: c.description, bannerImage: c.bannerImage, startsAt: c.startsAt, endsAt: c.endsAt, minDiscountPercent: c.minDiscountPercent, phase: phase(c) },
            products: products.map((p) => ({
                id: p.id,
                title: p.title,
                images: p.images.length ? p.images : p.variants[0]?.images ?? [],
                category: p.category,
                price: p.variants[0]?.price ?? null,
                compareAtPrice: p.variants[0]?.compareAtPrice ?? null,
            })),
        };
    }
}
export const campaignsService = new CampaignsService();
//# sourceMappingURL=campaigns.service.js.map