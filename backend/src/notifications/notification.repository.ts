import { prisma } from '../config/db.js';
import { Notification, NotificationEvent, NotificationStatus } from '@prisma/client';
import { CreateNotificationInput } from './types.js';

export class NotificationRepository {
    async create(data: CreateNotificationInput): Promise<Notification> {
        const createData: {
            userId?: string | null;
            role?: Notification['role'];
            type: Notification['type'];
            channel: Notification['channel'];
            status: NotificationStatus;
            subject?: string;
            content: string;
            metadata: any;
            eventKey?: string | null;
        } = {
            type: data.type,
            channel: data.channel,
            status: NotificationStatus.PENDING,
            content: data.content,
            metadata: data.metadata || {}
        };

        if (data.userId !== undefined) {
            createData.userId = data.userId;
        }
        if (data.role !== undefined) {
            createData.role = data.role;
        }
        if (data.subject !== undefined) {
            createData.subject = data.subject;
        }
        if (data.eventKey !== undefined) {
            createData.eventKey = data.eventKey;
        }

        return prisma.notification.create({
            data: createData
        });
    }

    /**
     * Check if a notification with a given eventKey already exists for a user.
     * Used for idempotency — prevents duplicate notifications.
     */
    async findByEventKey(userId: string, eventKey: string): Promise<Notification | null> {
        return prisma.notification.findFirst({
            where: { userId, eventKey }
        });
    }

    async findById(id: string): Promise<Notification | null> {
        return prisma.notification.findUnique({ where: { id } });
    }

    async updateStatus(id: string, status: NotificationStatus, sentAt?: Date): Promise<Notification> {
        const updateData: {
            status: NotificationStatus;
            sentAt?: Date;
        } = { status };

        if (sentAt !== undefined) {
            updateData.sentAt = sentAt;
        }

        return prisma.notification.update({
            where: { id },
            data: updateData
        });
    }

    async createEvent(notificationId: string, provider: string, status: NotificationStatus, providerMessageId?: string, error?: string): Promise<NotificationEvent> {
        const eventData: {
            notificationId: string;
            provider: string;
            status: NotificationStatus;
            providerMessageId?: string;
            error?: string;
        } = {
            notificationId,
            provider,
            status,
        };

        if (providerMessageId !== undefined) {
            eventData.providerMessageId = providerMessageId;
        }

        if (error !== undefined) {
            eventData.error = error;
        }

        return prisma.notificationEvent.create({
            data: eventData
        });
    }

    async findAll(page: number = 1, limit: number = 20): Promise<{ notifications: Notification[], total: number }> {
        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.notification.count()
        ]);
        return { notifications, total };
    }

    // =========================================================================
    // User-facing queries
    // =========================================================================

    /**
     * List notifications for a specific user (buyer/seller), paginated.
     */
    async findByUserId(userId: string, page: number = 1, limit: number = 20): Promise<{ notifications: Notification[], total: number }> {
        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.notification.count({ where: { userId } })
        ]);
        return { notifications, total };
    }

    /**
     * Mark a single notification as read.
     * Returns null if notification doesn't exist or doesn't belong to user.
     */
    async markAsRead(id: string, userId: string): Promise<Notification | null> {
        const notification = await prisma.notification.findFirst({
            where: { id, userId }
        });
        if (!notification) return null;
        if (notification.isRead) return notification; // Already read

        return prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() }
        });
    }

    /**
     * Count unread notifications for a user.
     */
    async countUnread(userId: string): Promise<number> {
        return prisma.notification.count({
            where: { userId, isRead: false }
        });
    }
}

export const notificationRepository = new NotificationRepository();
