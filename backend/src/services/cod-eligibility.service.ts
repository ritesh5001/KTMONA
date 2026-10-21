/**
 * Whether Cash on Delivery may be used for a buyer's order.
 *
 * On top of the platform-wide switch (Admin → Settings), an admin can turn COD
 * off for one customer, one seller (all their products) or one product. The
 * checkout enforces this, and the checkout page reads it to hide the COD
 * option.
 */

import { prisma } from '../config/db.js';
import { settingsService } from './settings.service.js';

export interface CodEligibility {
    available: boolean;
    /** Why COD is unavailable, worded for the buyer. Null when available. */
    reason: string | null;
    /** True when an admin block (not the platform switch) is the cause. */
    blocked: boolean;
}

export interface CodLine {
    productId: string;
    sellerId: string | null;
}

class CodEligibilityService {
    /**
     * Admin blocks only: the customer, any seller, or any product in the order.
     * The platform switch is checked separately by the caller when it matters.
     */
    async blockReason(userId: string, lines: CodLine[]): Promise<string | null> {
        const productIds = [...new Set(lines.map((l) => l.productId))];
        const sellerIds = [...new Set(lines.map((l) => l.sellerId).filter((id): id is string => Boolean(id)))];

        const [buyer, products, sellers] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { codDisabled: true } }),
            productIds.length
                ? prisma.product.findMany({ where: { id: { in: productIds }, codDisabled: true }, select: { title: true } })
                : Promise.resolve([]),
            sellerIds.length
                ? prisma.user.count({ where: { id: { in: sellerIds }, codDisabled: true } })
                : Promise.resolve(0),
        ]);

        if (buyer?.codDisabled) return 'Cash on Delivery is not available on your account. Please pay online.';
        if (products.length) {
            const name = products.length === 1 ? `"${products[0]!.title}"` : 'some items in your order';
            return `Cash on Delivery is not available for ${name}. Please pay online.`;
        }
        if (sellers > 0) return 'Cash on Delivery is not available for some items in your order. Please pay online.';
        return null;
    }

    async check(userId: string, lines: CodLine[]): Promise<CodEligibility> {
        if (!(await settingsService.isCodEnabled())) {
            return { available: false, reason: 'Cash on Delivery is not available right now. Please pay online.', blocked: false };
        }
        const reason = await this.blockReason(userId, lines);
        return { available: !reason, reason, blocked: Boolean(reason) };
    }
}

export const codEligibilityService = new CodEligibilityService();
