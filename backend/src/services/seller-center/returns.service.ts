/**
 * Seller returns & RTO, and claims for bad returns / lost RTO / payment issues.
 */

import { Prisma, ReturnStatus, SellerClaimStatus, SellerClaimType } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { parseLimit, parsePage, round2, utcDay } from './common.js';

export const RETURN_TABS = ['all', 'requested', 'approved', 'inspecting', 'refunded', 'rejected'] as const;
export type ReturnTab = (typeof RETURN_TABS)[number];

const CLAIM_WINDOW_DAYS = 30;

class SellerReturnsService {
    async listReturns(sellerId: string, query: Record<string, unknown>) {
        const tab = (RETURN_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as ReturnTab) : 'all';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit);
        const mine: Prisma.ReturnRequestWhereInput = { items: { some: { orderItem: { sellerId } } } };
        const where: Prisma.ReturnRequestWhereInput =
            tab === 'all' ? mine : { ...mine, status: tab.toUpperCase() as ReturnStatus };

        const [total, returns, grouped] = await Promise.all([
            prisma.returnRequest.count({ where }),
            prisma.returnRequest.findMany({
                where,
                include: { items: { include: { orderItem: true } } },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.returnRequest.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
        ]);

        const counts: Record<string, number> = { all: 0 };
        grouped.forEach((g) => {
            counts[g.status.toLowerCase()] = g._count._all;
            counts.all = (counts.all ?? 0) + g._count._all;
        });

        const variantIds = returns.flatMap((r) => r.items.map((i) => i.variantId));
        const variants = await prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, size: true, color: true, sku: true, images: true, product: { select: { title: true, images: true } } },
        });
        const vMap = new Map(variants.map((v) => [v.id, v]));
        const claims = await prisma.sellerClaim.findMany({
            where: { sellerId, returnId: { in: returns.map((r) => r.id) } },
            select: { returnId: true, claimNumber: true, status: true },
        });
        const claimMap = new Map(claims.map((c) => [c.returnId, c]));

        return {
            tab,
            counts,
            returns: returns.map((r) => {
                const items = r.items.filter((i) => i.orderItem.sellerId === sellerId);
                return {
                    id: r.id,
                    orderId: r.orderId,
                    status: r.status,
                    reason: r.reason,
                    rejectionReason: r.rejectionReason,
                    requestedAt: r.createdAt,
                    reviewedAt: r.reviewedAt,
                    items: items.map((i) => {
                        const v = vMap.get(i.variantId);
                        return {
                            title: v?.product.title ?? 'Product',
                            image: v?.images[0] ?? v?.product.images[0] ?? null,
                            size: v?.size,
                            color: v?.color,
                            sku: v?.sku,
                            quantity: i.quantity,
                            reason: i.reason,
                            amount: round2(i.orderItem.sellerPriceSnapshot * i.quantity),
                        };
                    }),
                    sellerAmount: round2(items.reduce((s, i) => s + i.orderItem.sellerPriceSnapshot * i.quantity, 0)),
                    claim: claimMap.get(r.id) ?? null,
                    canClaim: !claimMap.has(r.id) && ['APPROVED', 'INSPECTING', 'REFUNDED'].includes(r.status),
                };
            }),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async listRto(sellerId: string, query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit);
        const status = query.status === 'in_transit' ? ['RTO_INITIATED'] : query.status === 'received' ? ['RTO_DELIVERED'] : ['RTO_INITIATED', 'RTO_DELIVERED'];
        const where: Prisma.shipmentsWhereInput = { seller_id: sellerId, status: { in: status as never } };
        const [total, rows, inTransit, received] = await Promise.all([
            prisma.shipments.count({ where }),
            prisma.shipments.findMany({
                where,
                include: { orders: { select: { id: true, shippingName: true, shippingCity: true, items: { where: { sellerId } } } } },
                orderBy: { updated_at: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.shipments.count({ where: { seller_id: sellerId, status: 'RTO_INITIATED' } }),
            prisma.shipments.count({ where: { seller_id: sellerId, status: 'RTO_DELIVERED' } }),
        ]);
        const claims = await prisma.sellerClaim.findMany({
            where: { sellerId, orderId: { in: rows.map((r) => r.order_id) }, type: { in: ['RTO_DAMAGED', 'RTO_NOT_RECEIVED'] } },
            select: { orderId: true, claimNumber: true, status: true },
        });
        const claimMap = new Map(claims.map((c) => [c.orderId, c]));
        return {
            counts: { all: inTransit + received, in_transit: inTransit, received },
            rto: rows.map((s) => ({
                orderId: s.order_id,
                status: s.status,
                awb: s.tracking_number || null,
                carrier: s.carrier,
                reason: s.rto_reason,
                initiatedAt: s.rto_initiated_at,
                receivedAt: s.rto_delivered_at,
                customer: { name: s.orders.shippingName, city: s.orders.shippingCity },
                units: s.orders.items.reduce((n, i) => n + i.quantity, 0),
                sellerAmount: round2(s.orders.items.reduce((sum, i) => sum + i.sellerPriceSnapshot * i.quantity, 0)),
                claim: claimMap.get(s.order_id) ?? null,
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // ── Claims ──────────────────────────────────────────────────────────────

    async listClaims(sellerId: string, query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit);
        const status = typeof query.status === 'string' && query.status !== 'all' ? (query.status.toUpperCase() as SellerClaimStatus) : undefined;
        const where: Prisma.SellerClaimWhereInput = { sellerId, ...(status ? { status } : {}) };
        const [total, claims, grouped] = await Promise.all([
            prisma.sellerClaim.count({ where }),
            prisma.sellerClaim.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
            prisma.sellerClaim.groupBy({ by: ['status'], where: { sellerId }, _count: { _all: true } }),
        ]);
        const counts: Record<string, number> = { all: 0 };
        grouped.forEach((g) => {
            counts[g.status.toLowerCase()] = g._count._all;
            counts.all = (counts.all ?? 0) + g._count._all;
        });
        return { counts, claims, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async createClaim(
        sellerId: string,
        input: { orderId: string; returnId?: string | undefined; type: SellerClaimType; description: string; images?: string[] | undefined; amountClaimed?: number | undefined}
    ) {
        // Accept the full ID or the short "#AB12CD34" number shown in the panel.
        const ref = input.orderId.trim().replace(/^#/, '');
        const order = await prisma.order.findFirst({
            where: {
                items: { some: { sellerId } },
                OR: [{ id: ref }, ...(ref.length >= 6 && ref.length < 20 ? [{ id: { endsWith: ref.toLowerCase() } }] : [])],
            },
            include: { items: { where: { sellerId } }, shipments: { where: { seller_id: sellerId } } },
            orderBy: { createdAt: 'desc' },
        });
        if (!order) throw ApiError.notFound('Order not found');
        if (Date.now() - order.createdAt.getTime() > 120 * 86_400_000) {
            throw ApiError.badRequest('Claims can only be raised for orders from the last 120 days');
        }

        const isReturnClaim = ['DAMAGED_RETURN', 'WRONG_RETURN', 'MISSING_ITEM_IN_RETURN'].includes(input.type);
        if (isReturnClaim && !input.returnId) {
            // Raised from the help center with just the order number.
            const latest = await prisma.returnRequest.findFirst({
                where: { orderId: order.id, status: { not: 'REJECTED' }, items: { some: { orderItem: { sellerId } } } },
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            });
            if (!latest) throw ApiError.badRequest('No return found for this order');
            input = { ...input, returnId: latest.id };
        }
        if (isReturnClaim) {
            if (!input.returnId) throw ApiError.badRequest('Select the return this claim is about');
            const ret = await prisma.returnRequest.findFirst({ where: { id: input.returnId, orderId: order.id } });
            if (!ret) throw ApiError.notFound('Return not found for this order');
            if (Date.now() - (ret.reviewedAt ?? ret.createdAt).getTime() > CLAIM_WINDOW_DAYS * 86_400_000) {
                throw ApiError.badRequest(`Return claims must be raised within ${CLAIM_WINDOW_DAYS} days`);
            }
        }
        if (input.type === 'RTO_DAMAGED' || input.type === 'RTO_NOT_RECEIVED') {
            const s = order.shipments[0];
            if (!s || !['RTO_INITIATED', 'RTO_DELIVERED'].includes(s.status)) {
                throw ApiError.badRequest('This order is not an RTO');
            }
        }

        const duplicate = await prisma.sellerClaim.findFirst({
            where: { sellerId, orderId: order.id, type: input.type, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        });
        if (duplicate) throw ApiError.conflict(`Claim ${duplicate.claimNumber} is already open for this order`);

        const maxAmount = round2(order.items.reduce((s, i) => s + i.sellerPriceSnapshot * i.quantity, 0));
        const claimNumber = `CLM-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        return prisma.sellerClaim.create({
            data: {
                claimNumber,
                sellerId,
                orderId: order.id,
                returnId: input.returnId ?? null,
                type: input.type,
                description: input.description,
                images: input.images ?? [],
                amountClaimed: input.amountClaimed ? Math.min(input.amountClaimed, maxAmount) : maxAmount,
            },
        });
    }

    // ── Admin review ────────────────────────────────────────────────────────

    async adminList(query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 30);
        const status = typeof query.status === 'string' && query.status !== 'all' ? (query.status.toUpperCase() as SellerClaimStatus) : undefined;
        const where: Prisma.SellerClaimWhereInput = status ? { status } : {};
        const [total, claims] = await Promise.all([
            prisma.sellerClaim.count({ where }),
            prisma.sellerClaim.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        ]);
        const sellers = await prisma.seller_profiles.findMany({
            where: { user_id: { in: [...new Set(claims.map((c) => c.sellerId))] } },
            select: { user_id: true, store_name: true },
        });
        const nameMap = new Map(sellers.map((s) => [s.user_id, s.store_name]));
        return {
            claims: claims.map((c) => ({ ...c, storeName: nameMap.get(c.sellerId) ?? null })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async adminReview(adminId: string, claimId: string, input: { status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'; amountApproved?: number | undefined; note?: string | undefined}) {
        const claim = await prisma.sellerClaim.findUnique({ where: { id: claimId } });
        if (!claim) throw ApiError.notFound('Claim not found');
        if (claim.status === 'APPROVED' || claim.status === 'REJECTED') throw ApiError.badRequest('Claim is already closed');

        const amount = input.status === 'APPROVED' ? round2(input.amountApproved ?? claim.amountClaimed ?? 0) : null;
        return prisma.$transaction(async (tx) => {
            const updated = await tx.sellerClaim.update({
                where: { id: claimId },
                data: {
                    status: input.status,
                    amountApproved: amount,
                    resolutionNote: input.note ?? null,
                    reviewedBy: adminId,
                    reviewedAt: new Date(),
                },
            });
            if (input.status === 'APPROVED' && amount && amount > 0) {
                await tx.sellerLedgerEntry.create({
                    data: {
                        sellerId: claim.sellerId,
                        type: 'CLAIM_CREDIT',
                        amount,
                        referenceId: claim.id,
                        orderId: claim.orderId,
                        note: `Claim ${claim.claimNumber} approved`,
                        entryDate: utcDay(),
                    },
                });
            }
            return updated;
        });
    }
}

export const sellerReturnsService = new SellerReturnsService();
