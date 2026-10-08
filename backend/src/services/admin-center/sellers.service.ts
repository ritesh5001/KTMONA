/**
 * Admin seller management: list with performance, full seller profile,
 * KYC verification, suspension (hides listings), payout hold, commission.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { adminService } from '../admin.service.js';
import { invalidateProductCaches } from '../../utils/cache.util.js';
import { sellerInsightsService } from '../seller-center/insights.service.js';
import { sellerOrdersService } from '../seller-center/orders.service.js';
import { DEFAULT_COMMISSION_PCT, addDays, parseLimit, parsePage, round2, sellerCode } from '../seller-center/common.js';
import { adminPayoutsService } from './payouts.service.js';

export const SELLER_TABS = ['all', 'pending', 'active', 'suspended', 'kyc_review', 'at_risk'] as const;
type SellerTab = (typeof SELLER_TABS)[number];

function maskAccount(n: string) {
    return n.length <= 4 ? n : `••••${n.slice(-4)}`;
}

class AdminSellersService {
    private where(tab: SellerTab, search: string): Prisma.UserWhereInput {
        const base: Prisma.UserWhereInput = { role: 'SELLER' };
        if (search) {
            base.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { seller_profiles: { store_name: { contains: search, mode: 'insensitive' } } },
            ];
        }
        switch (tab) {
            case 'pending':
                return { ...base, status: 'PENDING' };
            case 'active':
                return { ...base, status: 'ACTIVE' };
            case 'suspended':
                return { ...base, status: 'SUSPENDED' };
            case 'kyc_review':
                return { ...base, seller_profiles: { kyc_status: 'PENDING', pan_number: { not: null } } };
            default:
                return base;
        }
    }

    async list(query: Record<string, unknown>) {
        const tab = (SELLER_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as SellerTab) : 'all';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 25);
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const where = this.where(tab === 'at_risk' ? 'active' : tab, search);

        const [counts, sellers] = await Promise.all([
            Promise.all(SELLER_TABS.filter((t) => t !== 'at_risk').map(async (t) => [t, await prisma.user.count({ where: this.where(t, '') })] as const)),
            prisma.user.findMany({
                where,
                select: { id: true, email: true, phone: true, status: true, createdAt: true, seller_profiles: true },
                orderBy: { createdAt: 'desc' },
                ...(tab === 'at_risk' ? {} : { skip: (page - 1) * limit, take: limit }),
            }),
        ]);

        const metrics = await this.metrics(sellers.map((s) => s.id));
        let rows = sellers.map((s) => {
            const m = metrics.get(s.id);
            const cancelRate = m && m.orders ? round2((m.cancellations / m.orders) * 100) : null;
            const atRisk = (cancelRate ?? 0) > 5 || (m?.rating != null && m.rating < 3.3);
            return {
                id: s.id,
                sellerCode: sellerCode(s.id),
                email: s.email,
                phone: s.phone,
                status: s.status,
                joinedAt: s.createdAt,
                storeName: s.seller_profiles?.store_name ?? null,
                kycStatus: s.seller_profiles?.kyc_status ?? 'PENDING',
                gstRegistered: s.seller_profiles?.gst_registered ?? null,
                payoutHold: s.seller_profiles?.payout_hold ?? false,
                liveProducts: m?.liveProducts ?? 0,
                orders30d: m?.orders ?? 0,
                gmv30d: m?.gmv ?? 0,
                cancelRate,
                rating: m?.rating ?? null,
                atRisk,
            };
        });
        let total = await prisma.user.count({ where });
        if (tab === 'at_risk') {
            rows = rows.filter((r) => r.atRisk);
            total = rows.length;
            rows = rows.slice((page - 1) * limit, page * limit);
        }
        const countMap: Record<string, number> = Object.fromEntries(counts);
        countMap.at_risk = await this.countAtRisk();
        return { tab, counts: countMap, sellers: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    private async countAtRisk(): Promise<number> {
        const active = await prisma.user.findMany({ where: { role: 'SELLER', status: 'ACTIVE' }, select: { id: true } });
        const metrics = await this.metrics(active.map((a) => a.id));
        let n = 0;
        metrics.forEach((m) => {
            const cancelRate = m.orders ? (m.cancellations / m.orders) * 100 : 0;
            if (cancelRate > 5 || (m.rating != null && m.rating < 3.3)) n += 1;
        });
        return n;
    }

    /** 30-day orders, GMV, seller cancellations, live products and rating per seller. */
    private async metrics(sellerIds: string[]) {
        const out = new Map<string, { orders: number; gmv: number; cancellations: number; liveProducts: number; rating: number | null }>();
        if (sellerIds.length === 0) return out;
        const since = addDays(new Date(), -30);
        const [sales, cancels, live, ratings] = await Promise.all([
            prisma.$queryRaw<{ seller_id: string; orders: bigint; gmv: number }[]>`
                SELECT oi."seller_id", COUNT(DISTINCT oi."order_id") AS orders, COALESCE(SUM(oi."price_snapshot" * oi."quantity"), 0) AS gmv
                FROM "order_items" oi JOIN "orders" o ON o."id" = oi."order_id"
                WHERE oi."seller_id" IN (${Prisma.join(sellerIds)}) AND o."created_at" >= ${since} AND o."status" NOT IN ('PLACED')
                GROUP BY oi."seller_id"`,
            prisma.sellerOrderCancellation.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds }, createdAt: { gte: since } }, _count: { _all: true } }),
            prisma.product.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellerIds }, isPublished: true, deletedByAdmin: false }, _count: { _all: true } }),
            prisma.$queryRaw<{ seller_id: string; rating: number }[]>`
                SELECT p."seller_id", AVG(r."rating")::float AS rating
                FROM "reviews" r JOIN "products" p ON p."id" = r."product_id"
                WHERE p."seller_id" IN (${Prisma.join(sellerIds)}) AND r."is_hidden" = false
                GROUP BY p."seller_id"`,
        ]);
        for (const id of sellerIds) {
            const s = sales.find((x) => x.seller_id === id);
            out.set(id, {
                orders: Number(s?.orders ?? 0),
                gmv: round2(Number(s?.gmv ?? 0)),
                cancellations: cancels.find((c) => c.sellerId === id)?._count._all ?? 0,
                liveProducts: live.find((l) => l.sellerId === id)?._count._all ?? 0,
                rating: ratings.find((r) => r.seller_id === id)?.rating ? round2(ratings.find((r) => r.seller_id === id)!.rating) : null,
            });
        }
        return out;
    }

    async detail(sellerId: string) {
        const user = await prisma.user.findFirst({
            where: { id: sellerId, role: 'SELLER' },
            select: { id: true, email: true, phone: true, whatsappNumber: true, status: true, createdAt: true, seller_profiles: { include: { seller_bank_accounts: true } } },
        });
        if (!user) throw ApiError.notFound('Seller not found');
        const p = user.seller_profiles;
        const [health, productCounts, lifetime, commission, due, payouts, penalties, orders] = await Promise.all([
            sellerInsightsService.health(sellerId, 30),
            prisma.product.groupBy({ by: ['status'], where: { sellerId, deletedByAdmin: false }, _count: { _all: true } }),
            prisma.$queryRaw<{ orders: bigint; gmv: number }[]>`
                SELECT COUNT(DISTINCT oi."order_id") AS orders, COALESCE(SUM(oi."price_snapshot" * oi."quantity"), 0) AS gmv
                FROM "order_items" oi JOIN "orders" o ON o."id" = oi."order_id"
                WHERE oi."seller_id" = ${sellerId} AND o."status" NOT IN ('PLACED', 'CANCELLED')`,
            prisma.sellerCommissionConfig.findUnique({ where: { sellerId } }),
            adminPayoutsService.due({ includeNotDue: false }),
            prisma.sellerPayout.findMany({ where: { sellerId }, orderBy: { createdAt: 'desc' }, take: 10 }),
            prisma.sellerLedgerEntry.findMany({ where: { sellerId, type: 'PENALTY' }, orderBy: { createdAt: 'desc' }, take: 10 }),
            sellerOrdersService.list(sellerId, { tab: 'all', limit: 10 }),
        ]);
        const myDue = due.find((d) => d.sellerId === sellerId);
        return {
            id: user.id,
            sellerCode: sellerCode(user.id),
            email: user.email,
            phone: user.phone,
            whatsapp: user.whatsappNumber,
            status: user.status,
            statusReason: p?.status_reason ?? null,
            joinedAt: user.createdAt,
            store: p && { name: p.store_name, slug: p.store_slug, description: p.store_description, supportEmail: p.support_email, supportPhone: p.support_phone, vacationMode: p.vacation_mode },
            kyc: p && {
                status: p.kyc_status,
                rejectionReason: p.kyc_rejection_reason,
                verifiedAt: p.kyc_verified_at,
                businessType: p.business_type,
                gstRegistered: p.gst_registered,
                gstin: p.gstin ?? p.gst_number,
                enrolmentId: p.enrolment_id,
                pan: p.pan_number,
                state: p.state,
                panMatchesGstin: Boolean(p.gstin && p.pan_number && p.gstin.slice(2, 12) === p.pan_number),
            },
            pickup: p && { contactName: p.pickup_contact_name, phone: p.pickup_phone, line1: p.pickup_address_line1, line2: p.pickup_address_line2, city: p.pickup_city, state: p.pickup_state, pincode: p.pickup_pincode },
            bankAccounts: (p?.seller_bank_accounts ?? []).map((b) => ({
                id: b.id,
                bankName: b.bank_name,
                holderName: b.account_holder_name,
                accountNumberMasked: maskAccount(b.account_number),
                ifsc: b.ifsc_code,
                isPrimary: b.is_primary,
                holderMatchesStore: p ? b.account_holder_name.trim().toLowerCase() === p.store_name.trim().toLowerCase() : false,
            })),
            payoutHold: p?.payout_hold ?? false,
            payoutHoldReason: p?.payout_hold_reason ?? null,
            commission: { commissionPct: commission ? Number(commission.commissionPct) : DEFAULT_COMMISSION_PCT, platformFee: commission ? Number(commission.platformFee) : 0, custom: Boolean(commission) },
            health,
            products: Object.fromEntries(productCounts.map((c) => [c.status, c._count._all])),
            lifetime: { orders: Number(lifetime[0]?.orders ?? 0), gmv: round2(Number(lifetime[0]?.gmv ?? 0)) },
            payoutDue: myDue ? { amount: myDue.amount, settlements: myDue.settlementIds.length, ledgerAmount: myDue.ledgerAmount } : { amount: 0, settlements: 0, ledgerAmount: 0 },
            payouts,
            penalties,
            recentOrders: orders.orders,
        };
    }

    async reviewKyc(adminId: string, sellerId: string, input: { status: 'VERIFIED' | 'REJECTED'; reason?: string | undefined }) {
        const profile = await prisma.seller_profiles.findUnique({ where: { user_id: sellerId } });
        if (!profile) throw ApiError.badRequest('This seller has not submitted business details yet');
        if (input.status === 'REJECTED' && !input.reason?.trim()) throw ApiError.badRequest('Give a reason so the seller can fix it');
        await prisma.seller_profiles.update({
            where: { user_id: sellerId },
            data: {
                kyc_status: input.status,
                kyc_rejection_reason: input.status === 'REJECTED' ? input.reason!.trim() : null,
                kyc_verified_at: input.status === 'VERIFIED' ? new Date() : null,
                updated_at: new Date(),
            },
        });
        await prisma.auditLog.create({
            data: { actorId: adminId, action: `SELLER_KYC_${input.status}`, entityType: 'USER', entityId: sellerId, metadata: { reason: input.reason ?? null } },
        }).catch(() => undefined);
        return this.detail(sellerId);
    }

    /** Approve / reactivate / suspend. Suspension hides every listing. */
    async setStatus(adminId: string, sellerId: string, input: { status: 'ACTIVE' | 'SUSPENDED'; reason?: string | undefined }) {
        const user = await prisma.user.findFirst({ where: { id: sellerId, role: 'SELLER' } });
        if (!user) throw ApiError.notFound('Seller not found');
        if (input.status === 'SUSPENDED' && !input.reason?.trim()) throw ApiError.badRequest('Give a reason for the suspension');

        if (input.status === 'ACTIVE' && user.status === 'PENDING') {
            await adminService.approveSeller(sellerId, adminId);
        } else if (input.status === 'SUSPENDED' && user.status !== 'SUSPENDED') {
            await adminService.suspendSeller(sellerId, adminId);
            await prisma.product.updateMany({ where: { sellerId, isPublished: true }, data: { isPublished: false } });
            await prisma.loginSession.deleteMany({ where: { userId: sellerId } }).catch(() => undefined);
        } else if (input.status === 'ACTIVE' && user.status === 'SUSPENDED') {
            await prisma.user.update({ where: { id: sellerId }, data: { status: 'ACTIVE' } });
            const products = await prisma.product.findMany({
                where: { sellerId, deletedByAdmin: false, pausedBySeller: false, pausedForVacation: false },
                select: { id: true, variants: { select: { status: true } } },
            });
            for (const pr of products) {
                if (pr.variants.some((v) => v.status === 'APPROVED')) await prisma.product.update({ where: { id: pr.id }, data: { isPublished: true } });
            }
        }
        await prisma.seller_profiles.updateMany({ where: { user_id: sellerId }, data: { status_reason: input.reason ?? null, updated_at: new Date() } });
        await invalidateProductCaches();
        return this.detail(sellerId);
    }

    async setPayoutHold(sellerId: string, input: { hold: boolean; reason?: string | undefined }) {
        if (input.hold && !input.reason?.trim()) throw ApiError.badRequest('Give a reason for holding payouts');
        const updated = await prisma.seller_profiles.updateMany({
            where: { user_id: sellerId },
            data: { payout_hold: input.hold, payout_hold_reason: input.hold ? input.reason!.trim() : null, updated_at: new Date() },
        });
        if (updated.count === 0) throw ApiError.badRequest('Seller has no profile yet');
        return this.detail(sellerId);
    }

    async setCommission(sellerId: string, input: { commissionPct: number; platformFee: number }) {
        if (input.commissionPct < 0 || input.commissionPct > 60) throw ApiError.badRequest('Commission must be between 0% and 60%');
        if (input.platformFee < 0 || input.platformFee > 500) throw ApiError.badRequest('Platform fee must be between 0 and 500');
        await prisma.sellerCommissionConfig.upsert({
            where: { sellerId },
            create: { sellerId, commissionPct: input.commissionPct, platformFee: input.platformFee },
            update: { commissionPct: input.commissionPct, platformFee: input.platformFee },
        });
        return this.detail(sellerId);
    }
}

export const adminSellersService = new AdminSellersService();
