/**
 * Customer account settings: notification consent and account-deletion requests.
 */

import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { notificationService } from '../notifications/notification.service.js';

export const notificationPreferencesSchema = z.object({
    /** Order, shipping and delivery updates by email. */
    email: z.boolean().optional(),
    /** Same updates by SMS (sent once an SMS provider is connected). */
    sms: z.boolean().optional(),
    /** Same updates on WhatsApp (sent once a WhatsApp provider is connected). */
    whatsapp: z.boolean().optional(),
    /** Offers and promotions. */
    marketing: z.boolean().optional(),
});

export const deletionRequestSchema = z.object({
    reason: z.string().trim().max(500).optional(),
});

export interface NotificationPreferences {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    marketing: boolean;
    /** Channels that can actually deliver right now (in-app always can). */
    available: { email: boolean; sms: boolean; whatsapp: boolean };
}

/** SMS/WhatsApp senders are not connected yet; consent is stored for when they are. */
const CHANNELS_LIVE = { email: true, sms: false, whatsapp: false };

function toPreferences(row: {
    email_notifications: boolean;
    sms_notifications: boolean;
    whatsapp_notifications: boolean;
    marketing_notifications: boolean;
} | null): NotificationPreferences {
    return {
        email: row?.email_notifications ?? true,
        sms: row?.sms_notifications ?? true,
        whatsapp: row?.whatsapp_notifications ?? false,
        marketing: row?.marketing_notifications ?? false,
        available: CHANNELS_LIVE,
    };
}

export const accountSettingsService = {
    async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
        const row = await prisma.user_preferences.findUnique({ where: { user_id: userId } });
        return toPreferences(row);
    },

    async updateNotificationPreferences(
        userId: string,
        input: z.infer<typeof notificationPreferencesSchema>,
    ): Promise<NotificationPreferences> {
        const data = {
            ...(input.email !== undefined ? { email_notifications: input.email } : {}),
            ...(input.sms !== undefined ? { sms_notifications: input.sms } : {}),
            ...(input.whatsapp !== undefined ? { whatsapp_notifications: input.whatsapp } : {}),
            ...(input.marketing !== undefined ? { marketing_notifications: input.marketing } : {}),
            updated_at: new Date(),
        };
        const row = await prisma.user_preferences.upsert({
            where: { user_id: userId },
            create: { user_id: userId, ...data },
            update: data,
        });
        return toPreferences(row);
    },

    /** Whether order/shipping update emails may be sent to this user. */
    async allowsOrderEmails(userId: string): Promise<boolean> {
        const row = await prisma.user_preferences.findUnique({
            where: { user_id: userId },
            select: { email_notifications: true },
        });
        return row?.email_notifications ?? true;
    },

    async getDeletionRequest(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { deletionRequestedAt: true, deletionReason: true },
        });
        return {
            requested: Boolean(user?.deletionRequestedAt),
            requestedAt: user?.deletionRequestedAt?.toISOString() ?? null,
            reason: user?.deletionReason ?? null,
        };
    },

    /**
     * Ask for the account to be deleted. An admin completes it (open orders,
     * refunds and tax records are settled first); the customer can withdraw the
     * request until then.
     */
    async requestDeletion(userId: string, reason: string | undefined) {
        const open = await prisma.order.count({
            where: { userId, status: { in: ['PLACED', 'CONFIRMED', 'SHIPPED'] } },
        });
        const user = await prisma.user.update({
            where: { id: userId },
            data: { deletionRequestedAt: new Date(), deletionReason: reason?.trim() || null },
            select: { email: true, phone: true, deletionRequestedAt: true, deletionReason: true },
        });
        await notificationService.notifyAdmin(
            'Account deletion requested',
            `Customer ${user.email ?? user.phone ?? userId} (${userId}) asked for their account to be deleted.${open ? ` They have ${open} open order(s).` : ''}${user.deletionReason ? ` Reason: ${user.deletionReason}` : ''}`,
        );
        return {
            requested: true,
            requestedAt: user.deletionRequestedAt?.toISOString() ?? null,
            reason: user.deletionReason,
            openOrders: open,
        };
    },

    async cancelDeletion(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletionRequestedAt: true } });
        if (!user?.deletionRequestedAt) {
            throw ApiError.badRequest('There is no deletion request to withdraw');
        }
        await prisma.user.update({
            where: { id: userId },
            data: { deletionRequestedAt: null, deletionReason: null },
        });
        return { requested: false, requestedAt: null, reason: null };
    },
};
