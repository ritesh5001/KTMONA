import { Notification, NotificationEvent, NotificationStatus } from '@prisma/client';
import { CreateNotificationInput } from './types.js';
export declare class NotificationRepository {
    create(data: CreateNotificationInput): Promise<Notification>;
    /**
     * Check if a notification with a given eventKey already exists for a user.
     * Used for idempotency — prevents duplicate notifications.
     */
    findByEventKey(userId: string, eventKey: string): Promise<Notification | null>;
    findById(id: string): Promise<Notification | null>;
    updateStatus(id: string, status: NotificationStatus, sentAt?: Date): Promise<Notification>;
    createEvent(notificationId: string, provider: string, status: NotificationStatus, providerMessageId?: string, error?: string): Promise<NotificationEvent>;
    findAll(page?: number, limit?: number): Promise<{
        notifications: Notification[];
        total: number;
    }>;
    /**
     * List notifications for a specific user (buyer/seller), paginated.
     */
    findByUserId(userId: string, page?: number, limit?: number): Promise<{
        notifications: Notification[];
        total: number;
    }>;
    /**
     * Mark a single notification as read.
     * Returns null if notification doesn't exist or doesn't belong to user.
     */
    markAsRead(id: string, userId: string): Promise<Notification | null>;
    /**
     * Count unread notifications for a user.
     */
    countUnread(userId: string): Promise<number>;
}
export declare const notificationRepository: NotificationRepository;
//# sourceMappingURL=notification.repository.d.ts.map