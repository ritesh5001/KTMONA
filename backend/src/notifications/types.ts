import { NotificationType, NotificationChannel, Role } from '@prisma/client';

export interface CreateNotificationInput {
    userId?: string | null;
    role?: Role | null;
    type: NotificationType;
    channel: NotificationChannel;
    subject?: string;
    content: string;
    metadata?: any;
    eventKey?: string | null;
}

export interface NotificationJobPayload {
    notificationId: string;
}

export interface EmailTemplateResult {
    subject: string;
    html: string;
}
