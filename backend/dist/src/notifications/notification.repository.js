import { prisma } from '../config/db.js';
import { NotificationStatus } from '@prisma/client';
export class NotificationRepository {
    async create(data) {
        const createData = {
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
    async findByEventKey(userId, eventKey) {
        return prisma.notification.findFirst({
            where: { userId, eventKey }
        });
    }
    async findById(id) {
        return prisma.notification.findUnique({ where: { id } });
    }
    async updateStatus(id, status, sentAt) {
        const updateData = { status };
        if (sentAt !== undefined) {
            updateData.sentAt = sentAt;
        }
        return prisma.notification.update({
            where: { id },
            data: updateData
        });
    }
    async createEvent(notificationId, provider, status, providerMessageId, error) {
        const eventData = {
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
    async findAll(page = 1, limit = 20) {
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
    async findByUserId(userId, page = 1, limit = 20) {
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
    async markAsRead(id, userId) {
        const notification = await prisma.notification.findFirst({
            where: { id, userId }
        });
        if (!notification)
            return null;
        if (notification.isRead)
            return notification; // Already read
        return prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() }
        });
    }
    /**
     * Count unread notifications for a user.
     */
    async countUnread(userId) {
        return prisma.notification.count({
            where: { userId, isRead: false }
        });
    }
}
export const notificationRepository = new NotificationRepository();
//# sourceMappingURL=notification.repository.js.map