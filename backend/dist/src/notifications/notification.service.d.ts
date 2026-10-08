import { CreateNotificationInput } from './types.js';
export declare class NotificationService {
    /**
     * Core method to create notification and add to queue.
     * IDEMPOTENT: If eventKey is provided and a notification with that key
     * already exists for the user, the duplicate is silently skipped.
     */
    create(data: CreateNotificationInput): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger ORDER_PLACED (Buyer)
     */
    notifyOrderPlaced(userId: string, orderId: string, totalAmount: number): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger SELLER_NEW_ORDER (Seller)
     */
    notifySellerNewOrder(sellerId: string, orderId: string, itemsCount: number): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger PAYMENT_SUCCESS (Buyer)
     */
    notifyPaymentSuccess(userId: string, orderId: string, amount: number): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger PAYMENT_FAILED (Buyer)
     */
    notifyPaymentFailed(userId: string, orderId: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger SHIPMENT_CREATED (Buyer)
     */
    notifyShipmentCreated(userId: string, orderId: string, carrier: string, trackingNumber: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger ORDER_SHIPPED (Buyer)
     */
    notifyOrderShipped(userId: string, orderId: string, carrier: string, trackingNumber: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger ORDER_DELIVERED (Buyer)
     */
    notifyOrderDelivered(userId: string, orderId: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger SELLER_APPROVED (Seller)
     */
    notifySellerApproved(sellerId: string, email?: string | null): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    notifySellerProductApproved(sellerId: string, productTitle: string, email?: string | null): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    notifySellerProductRejected(sellerId: string, productTitle: string, reason: string, email?: string | null): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
    /**
     * Trigger ADMIN_ALERT
     */
    notifyAdmin(title: string, message: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        role: import(".prisma/client").Role | null;
        type: import(".prisma/client").NotificationType;
        channel: import(".prisma/client").NotificationChannel;
        status: import(".prisma/client").NotificationStatus;
        subject: string | null;
        content: string;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        eventKey: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        sentAt: Date | null;
    }, unknown> & {}>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map