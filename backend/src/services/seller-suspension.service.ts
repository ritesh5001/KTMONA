/**
 * Seller suspension lifecycle shared by the admin panel and the login flow.
 *
 * A suspension may be open-ended (lifted by an admin after review) or
 * temporary (`suspended_until`), in which case it lifts by itself the first
 * time it is noticed after that moment — at the seller's next sign-in, or when
 * an admin opens the sellers list.
 */

import { prisma } from '../config/db.js';
import { invalidateProductCaches } from '../utils/cache.util.js';

export const sellerSuspensionService = {
    /** Reactivate a suspended seller and re-publish their live listings. */
    async reactivate(sellerId: string): Promise<void> {
        await prisma.user.update({ where: { id: sellerId }, data: { status: 'ACTIVE' } });
        await prisma.seller_profiles.updateMany({
            where: { user_id: sellerId },
            data: { suspended_until: null, updated_at: new Date() },
        });
        const products = await prisma.product.findMany({
            where: { sellerId, deletedByAdmin: false, pausedBySeller: false, pausedForVacation: false },
            select: { id: true, variants: { select: { status: true } } },
        });
        for (const pr of products) {
            if (pr.variants.some((v) => v.status === 'APPROVED')) {
                await prisma.product.update({ where: { id: pr.id }, data: { isPublished: true } });
            }
        }
        await invalidateProductCaches();
    },

    /**
     * Lift this seller's suspension if its end date has passed.
     * Returns true when the account is (now) active.
     */
    async liftIfExpired(sellerId: string): Promise<boolean> {
        const profile = await prisma.seller_profiles.findUnique({
            where: { user_id: sellerId },
            select: { suspended_until: true, users: { select: { status: true } } },
        });
        if (!profile || profile.users.status !== 'SUSPENDED') return profile?.users.status === 'ACTIVE';
        if (!profile.suspended_until || profile.suspended_until > new Date()) return false;
        await this.reactivate(sellerId);
        return true;
    },

    /** Lift every temporary suspension whose end date has passed. */
    async liftAllExpired(): Promise<number> {
        const due = await prisma.seller_profiles.findMany({
            where: { suspended_until: { lte: new Date() }, users: { status: 'SUSPENDED' } },
            select: { user_id: true },
        });
        for (const row of due) await this.reactivate(row.user_id);
        return due.length;
    },

    /** Why and until when a seller is suspended (shown on the login page). */
    async describe(sellerId: string): Promise<{ reason: string | null; until: Date | null }> {
        const profile = await prisma.seller_profiles.findUnique({
            where: { user_id: sellerId },
            select: { status_reason: true, suspended_until: true },
        });
        return { reason: profile?.status_reason ?? null, until: profile?.suspended_until ?? null };
    },
};
