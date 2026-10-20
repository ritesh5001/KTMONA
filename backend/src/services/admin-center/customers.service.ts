/**
 * Admin customer management: list and search buyers, full customer profile
 * (contact, addresses, orders), suspension, Cash on Delivery switch and
 * permanent deletion.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { auditService } from '../audit.service.js';
import { parseLimit, parsePage } from '../seller-center/common.js';

export const CUSTOMER_TABS = ['all', 'active', 'suspended', 'cod_off'] as const;
type CustomerTab = (typeof CUSTOMER_TABS)[number];

/** Orders that count as real purchases (paid or COD-confirmed, not cancelled). */
const PURCHASED: Prisma.OrderWhereInput = { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } };

class AdminCustomersService {
    private where(tab: CustomerTab, search: string): Prisma.UserWhereInput {
        const base: Prisma.UserWhereInput = { role: 'USER' };
        if (search) {
            base.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { user_profiles: { full_name: { contains: search, mode: 'insensitive' } } },
            ];
        }
        switch (tab) {
            case 'active':
                return { ...base, status: 'ACTIVE' };
            case 'suspended':
                return { ...base, status: 'SUSPENDED' };
            case 'cod_off':
                return { ...base, codDisabled: true };
            default:
                return base;
        }
    }

    async list(query: Record<string, unknown>) {
        const tab = (CUSTOMER_TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as CustomerTab) : 'all';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 25);
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const where = this.where(tab, search);

        const [counts, total, users] = await Promise.all([
            Promise.all(CUSTOMER_TABS.map(async (t) => [t, await prisma.user.count({ where: this.where(t, '') })] as const)),
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    status: true,
                    codDisabled: true,
                    state: true,
                    createdAt: true,
                    user_profiles: { select: { full_name: true } },
                },
            }),
        ]);

        const ids = users.map((u) => u.id);
        const stats = ids.length
            ? await prisma.order.groupBy({
                  by: ['userId'],
                  where: { userId: { in: ids }, ...PURCHASED },
                  _count: { _all: true },
                  _sum: { grandTotal: true },
                  _max: { createdAt: true },
              })
            : [];
        const byUser = new Map(stats.map((s) => [s.userId, s]));

        return {
            tab,
            counts: Object.fromEntries(counts),
            customers: users.map((u) => {
                const s = byUser.get(u.id);
                return {
                    id: u.id,
                    name: u.user_profiles?.full_name ?? null,
                    email: u.email,
                    phone: u.phone,
                    status: u.status,
                    codDisabled: u.codDisabled,
                    state: u.state,
                    joinedAt: u.createdAt,
                    orders: s?._count._all ?? 0,
                    spent: Math.round((s?._sum.grandTotal ?? 0) * 100) / 100,
                    lastOrderAt: s?._max.createdAt ?? null,
                };
            }),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        };
    }

    async detail(customerId: string) {
        const user = await prisma.user.findFirst({
            where: { id: customerId, role: 'USER' },
            select: {
                id: true,
                email: true,
                phone: true,
                whatsappNumber: true,
                status: true,
                codDisabled: true,
                state: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                createdAt: true,
                user_profiles: { select: { full_name: true, gender: true, dob: true } },
                user_addresses: {
                    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
                    select: { id: true, label: true, address_line_1: true, address_line_2: true, city: true, state: true, pincode: true, is_default: true },
                },
                loginSessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            },
        });
        if (!user) throw ApiError.notFound('Customer not found');

        const [purchased, byStatus, orders, returns, cancellations, reviews, wishlist, cartItems, suspension] = await Promise.all([
            prisma.order.aggregate({ where: { userId: customerId, ...PURCHASED }, _count: { _all: true }, _sum: { grandTotal: true } }),
            prisma.order.groupBy({ by: ['status'], where: { userId: customerId }, _count: { _all: true } }),
            prisma.order.findMany({
                where: { userId: customerId },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    createdAt: true,
                    status: true,
                    grandTotal: true,
                    shippingCity: true,
                    payment: { select: { provider: true, status: true } },
                    _count: { select: { items: true } },
                },
            }),
            prisma.returnRequest.count({ where: { userId: customerId } }),
            prisma.cancellationRequest.count({ where: { userId: customerId } }),
            prisma.review.count({ where: { userId: customerId } }),
            prisma.wishlist.findFirst({ where: { userId: customerId }, select: { _count: { select: { items: true } } } }),
            prisma.cart.findUnique({ where: { userId: customerId }, select: { _count: { select: { items: true } } } }),
            user.status === 'SUSPENDED'
                ? prisma.auditLog.findFirst({
                      where: { entityType: 'USER', entityId: customerId, action: 'CUSTOMER_SUSPENDED' },
                      orderBy: { createdAt: 'desc' },
                      select: { metadata: true, createdAt: true },
                  })
                : Promise.resolve(null),
        ]);

        const reason = (suspension?.metadata as { reason?: string } | null)?.reason ?? null;

        return {
            id: user.id,
            name: user.user_profiles?.full_name ?? null,
            email: user.email,
            phone: user.phone,
            whatsapp: user.whatsappNumber,
            gender: user.user_profiles?.gender ?? null,
            dob: user.user_profiles?.dob ?? null,
            state: user.state,
            status: user.status,
            statusReason: reason,
            suspendedAt: suspension?.createdAt ?? null,
            codDisabled: user.codDisabled,
            emailVerified: user.isEmailVerified,
            phoneVerified: user.isPhoneVerified,
            joinedAt: user.createdAt,
            lastLoginAt: user.loginSessions[0]?.createdAt ?? null,
            addresses: user.user_addresses.map((a) => ({
                id: a.id,
                label: a.label,
                line1: a.address_line_1,
                line2: a.address_line_2,
                city: a.city,
                state: a.state,
                pincode: a.pincode,
                isDefault: a.is_default,
            })),
            stats: {
                orders: purchased._count._all,
                spent: Math.round((purchased._sum.grandTotal ?? 0) * 100) / 100,
                byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])),
                returns,
                cancellations,
                reviews,
                wishlist: wishlist?._count.items ?? 0,
                cart: cartItems?._count.items ?? 0,
            },
            recentOrders: orders.map((o) => ({
                id: o.id,
                createdAt: o.createdAt,
                status: o.status,
                amount: o.grandTotal,
                items: o._count.items,
                city: o.shippingCity,
                paymentMethod: o.payment?.provider === 'COD' ? 'COD' : 'ONLINE',
                paymentStatus: o.payment?.status ?? null,
            })),
        };
    }

    private async find(customerId: string) {
        const user = await prisma.user.findFirst({ where: { id: customerId, role: 'USER' }, select: { id: true, status: true, email: true, phone: true } });
        if (!user) throw ApiError.notFound('Customer not found');
        return user;
    }

    /** Suspend signs the customer out everywhere and blocks login and OTP. */
    async setStatus(adminId: string, customerId: string, input: { status: 'ACTIVE' | 'SUSPENDED'; reason?: string | undefined }) {
        const user = await this.find(customerId);
        if (input.status === 'SUSPENDED') {
            if (!input.reason?.trim()) throw ApiError.badRequest('Give a reason for the suspension');
            if (user.status !== 'SUSPENDED') {
                await prisma.user.update({ where: { id: customerId }, data: { status: 'SUSPENDED' } });
                await prisma.loginSession.deleteMany({ where: { userId: customerId } }).catch(() => undefined);
            }
            await auditService.logAction(adminId, 'CUSTOMER_SUSPENDED', 'USER', customerId, { previousStatus: user.status, reason: input.reason.trim() });
        } else if (user.status !== 'ACTIVE') {
            await prisma.user.update({ where: { id: customerId }, data: { status: 'ACTIVE' } });
            await auditService.logAction(adminId, 'CUSTOMER_REACTIVATED', 'USER', customerId, { previousStatus: user.status, reason: input.reason ?? null });
        }
        return this.detail(customerId);
    }

    async setCod(adminId: string, customerId: string, disabled: boolean) {
        await this.find(customerId);
        await prisma.user.update({ where: { id: customerId }, data: { codDisabled: disabled } });
        await auditService.logAction(adminId, disabled ? 'CUSTOMER_COD_DISABLED' : 'CUSTOMER_COD_ENABLED', 'USER', customerId, {});
        return this.detail(customerId);
    }

    /**
     * Permanently delete a customer account: profile, addresses, cart,
     * wishlist, reviews, sessions. Their past orders stay on record (invoices,
     * GST and seller settlements depend on them) without a linked account.
     * Refused while an order is still in progress or a return / cancellation
     * is open, since the refund for it would have nowhere to go. The admin
     * confirms by typing the customer's email or mobile number.
     */
    async deletePermanently(adminId: string, customerId: string, confirm: string) {
        const user = await this.find(customerId);
        const expected = (user.email ?? user.phone ?? '').trim().toLowerCase();
        if (!expected || confirm.trim().toLowerCase() !== expected) {
            throw ApiError.badRequest(`Type the customer's ${user.email ? 'email' : 'mobile number'} exactly to confirm`);
        }

        const [openOrders, openReturns, openCancellations] = await Promise.all([
            prisma.order.count({ where: { userId: customerId, status: { in: ['CONFIRMED', 'SHIPPED'] } } }),
            prisma.returnRequest.count({ where: { userId: customerId, status: { in: ['REQUESTED', 'APPROVED', 'INSPECTING'] } } }),
            prisma.cancellationRequest.count({ where: { userId: customerId, status: 'REQUESTED' } }),
        ]);
        const open = [
            openOrders ? `${openOrders} order${openOrders === 1 ? '' : 's'} in progress` : null,
            openReturns ? `${openReturns} open return${openReturns === 1 ? '' : 's'}` : null,
            openCancellations ? `${openCancellations} open cancellation${openCancellations === 1 ? '' : 's'}` : null,
        ].filter(Boolean);
        if (open.length) {
            throw ApiError.badRequest(`This customer has ${open.join(' and ')}, so the account cannot be deleted yet. Suspend the customer instead, and delete once these are closed.`);
        }

        try {
            await prisma.$transaction(
                async (tx) => {
                    // No foreign key to the user on these, so nothing cascades to them.
                    await tx.$executeRaw`DELETE FROM "cart_items" WHERE "cart_id" IN (SELECT "id" FROM "carts" WHERE "user_id" = ${customerId})`;
                    await tx.$executeRaw`DELETE FROM "carts" WHERE "user_id" = ${customerId}`;
                    await tx.$executeRaw`DELETE FROM "notifications" WHERE "user_id" = ${customerId}`;
                    await tx.$executeRaw`UPDATE "site_events" SET "user_id" = NULL WHERE "user_id" = ${customerId}`;
                    // Profile, addresses, wishlist, reviews, sessions, OTPs… cascade.
                    await tx.user.delete({ where: { id: customerId } });
                    await tx.auditLog.create({
                        data: { actorId: adminId, action: 'CUSTOMER_DELETED', entityType: 'USER', entityId: customerId, metadata: { email: user.email, phone: user.phone } },
                    });
                },
                { maxWait: 10_000, timeout: 60_000 },
            );
        } catch (err) {
            console.error(`[admin] permanent delete of customer ${customerId} failed:`, err);
            const detail =
                err instanceof Prisma.PrismaClientKnownRequestError
                    ? ` (${err.code}${err.meta ? `: ${JSON.stringify(err.meta)}` : ''})`
                    : err instanceof Error
                      ? ` (${err.message.split('\n').filter(Boolean).pop()?.slice(0, 200)})`
                      : '';
            throw ApiError.badRequest(`Could not delete this customer. Nothing was removed.${detail}`);
        }
        return { deleted: true };
    }
}

export const adminCustomersService = new AdminCustomersService();
