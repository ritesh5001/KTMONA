/**
 * Saved payment methods, held by Razorpay as tokens under the buyer's Razorpay
 * customer. KTMONA stores only the customer id — never card numbers or UPI PINs.
 */

import { prisma } from '../config/db.js';
import { paymentLogger } from '../config/logger.js';
import { ApiError } from '../errors/ApiError.js';
import {
    createRazorpayCustomer,
    deleteRazorpayToken,
    isRazorpayConfigured,
    listRazorpayTokens,
    type RazorpayToken,
} from './razorpay.client.js';

export interface SavedPaymentMethod {
    id: string;
    method: 'card' | 'upi' | 'netbanking' | 'wallet' | string;
    /** e.g. "Visa •••• 4242" or "name@okaxis". */
    label: string;
    detail: string | null;
    expired: boolean;
}

function describe(token: RazorpayToken): SavedPaymentMethod {
    const expired = Boolean(token.expired_at && token.expired_at * 1000 < Date.now());
    if (token.method === 'card' && token.card) {
        const network = token.card.network ?? 'Card';
        return {
            id: token.id,
            method: 'card',
            label: `${network} •••• ${token.card.last4 ?? ''}`.trim(),
            detail: [token.card.issuer, token.card.type, token.card.expiry_month && token.card.expiry_year ? `exp ${token.card.expiry_month}/${String(token.card.expiry_year).slice(-2)}` : null]
                .filter(Boolean)
                .join(' · ') || null,
            expired,
        };
    }
    if (token.method === 'upi' && token.vpa) {
        const vpa = token.vpa.username && token.vpa.handle ? `${token.vpa.username}@${token.vpa.handle}` : token.vpa.username ?? 'UPI ID';
        return { id: token.id, method: 'upi', label: vpa, detail: token.vpa.name ?? null, expired };
    }
    return { id: token.id, method: token.method, label: token.bank ?? token.wallet ?? token.method, detail: null, expired };
}

export const savedPaymentsService = {
    /**
     * The buyer's Razorpay customer id, creating the customer on first use.
     * Returns null (pay without saved methods) if Razorpay is unreachable.
     */
    async ensureCustomerId(userId: string, contact: { name?: string | null; email?: string | null; phone?: string | null }): Promise<string | null> {
        if (!isRazorpayConfigured()) return null;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { razorpayCustomerId: true, email: true, phone: true, user_profiles: { select: { full_name: true } } },
        });
        if (!user) return null;
        if (user.razorpayCustomerId) return user.razorpayCustomerId;

        try {
            const customer = await createRazorpayCustomer({
                name: contact.name ?? user.user_profiles?.full_name ?? undefined,
                email: user.email ?? contact.email ?? undefined,
                contact: user.phone ?? contact.phone ?? undefined,
            });
            await prisma.user.update({ where: { id: userId }, data: { razorpayCustomerId: customer.id } }).catch(() => undefined);
            return customer.id;
        } catch (error) {
            paymentLogger.warn({ event: 'razorpay_customer_create_failed', userId, error: error instanceof Error ? error.message : String(error) }, 'Paying without saved methods');
            return null;
        }
    },

    async list(userId: string): Promise<{ methods: SavedPaymentMethod[]; enabled: boolean }> {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { razorpayCustomerId: true } });
        if (!isRazorpayConfigured() || !user?.razorpayCustomerId) {
            return { methods: [], enabled: isRazorpayConfigured() };
        }
        const tokens = await listRazorpayTokens(user.razorpayCustomerId);
        return { methods: tokens.map(describe), enabled: true };
    },

    async remove(userId: string, tokenId: string): Promise<{ removed: boolean }> {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { razorpayCustomerId: true } });
        if (!user?.razorpayCustomerId) {
            throw ApiError.notFound('No saved payment methods');
        }
        // Only tokens under this buyer's own customer can be deleted.
        const tokens = await listRazorpayTokens(user.razorpayCustomerId);
        if (!tokens.some((t) => t.id === tokenId)) {
            throw ApiError.notFound('Saved payment method not found');
        }
        await deleteRazorpayToken(user.razorpayCustomerId, tokenId);
        return { removed: true };
    },
};
