import { CreateNotificationInput } from './types.js';
import { notificationRepository } from './notification.repository.js';
import { notificationQueue } from './notification.queue.js';

export class NotificationService {

    /**
     * Core method to create notification and add to queue.
     * IDEMPOTENT: If eventKey is provided and a notification with that key
     * already exists for the user, the duplicate is silently skipped.
     */
    async create(data: CreateNotificationInput) {
        // Idempotency gate: check eventKey
        if (data.eventKey && data.userId) {
            const existing = await notificationRepository.findByEventKey(data.userId, data.eventKey);
            if (existing) {
                console.log(`[Notification] Duplicate skipped: eventKey=${data.eventKey}`);
                return existing;
            }
        }

        // 1. Persist to DB (Status: PENDING)
        const notification = await notificationRepository.create(data);

        // 2. Add to BullMQ
        await notificationQueue.add(data.type, {
            notificationId: notification.id
        });

        return notification;
    }

    /**
     * Trigger ORDER_PLACED (Buyer)
     */
    async notifyOrderPlaced(userId: string, orderId: string, totalAmount: number) {
        return this.create({
            userId,
            role: 'USER',
            type: 'ORDER_PLACED',
            channel: 'EMAIL',
            content: `Order #${orderId} Placed`,
            metadata: { orderId, totalAmount },
            eventKey: `ORDER_PLACED:${orderId}`
        });
    }

    /**
     * Trigger SELLER_NEW_ORDER (Seller)
     */
    async notifySellerNewOrder(sellerId: string, orderId: string, itemsCount: number) {
        return this.create({
            userId: sellerId,
            role: 'SELLER',
            type: 'SELLER_NEW_ORDER',
            channel: 'EMAIL',
            content: `New Order #${orderId}`,
            metadata: { orderId, itemsCount },
            eventKey: `SELLER_NEW_ORDER:${orderId}`
        });
    }

    /**
     * Trigger PAYMENT_SUCCESS (Buyer)
     */
    async notifyPaymentSuccess(userId: string, orderId: string, amount: number) {
        return this.create({
            userId,
            role: 'USER',
            type: 'PAYMENT_SUCCESS',
            channel: 'EMAIL',
            content: `Payment confirmed for Order #${orderId}`,
            metadata: { orderId, amount },
            eventKey: `PAYMENT_SUCCESS:${orderId}`
        });
    }

    /**
     * Trigger PAYMENT_FAILED (Buyer)
     */
    async notifyPaymentFailed(userId: string, orderId: string) {
        return this.create({
            userId,
            role: 'USER',
            type: 'PAYMENT_FAILED',
            channel: 'EMAIL',
            content: `Payment failed for Order #${orderId}`,
            metadata: { orderId },
            eventKey: `PAYMENT_FAILED:${orderId}`
        });
    }

    /**
     * Trigger SHIPMENT_CREATED (Buyer)
     */
    async notifyShipmentCreated(userId: string, orderId: string, carrier: string, trackingNumber: string) {
        return this.create({
            userId,
            role: 'USER',
            type: 'SHIPMENT_CREATED',
            channel: 'EMAIL',
            content: `Shipment created for Order #${orderId}`,
            metadata: { orderId, carrier, trackingNumber },
            eventKey: `SHIPMENT_CREATED:${orderId}`
        });
    }

    /**
     * Trigger ORDER_SHIPPED (Buyer)
     */
    async notifyOrderShipped(userId: string, orderId: string, carrier: string, trackingNumber: string) {
        return this.create({
            userId,
            role: 'USER',
            type: 'ORDER_SHIPPED',
            channel: 'EMAIL',
            content: `Order #${orderId} Shipped`,
            metadata: { orderId, carrier, trackingNumber },
            eventKey: `ORDER_SHIPPED:${orderId}`
        });
    }

    /**
     * Trigger ORDER_DELIVERED (Buyer)
     */
    async notifyOrderDelivered(userId: string, orderId: string) {
        return this.create({
            userId,
            role: 'USER',
            type: 'ORDER_DELIVERED',
            channel: 'EMAIL',
            content: `Order #${orderId} Delivered`,
            metadata: { orderId },
            eventKey: `ORDER_DELIVERED:${orderId}`
        });
    }

    /**
     * Trigger SELLER_APPROVED (Seller)
     */
    async notifySellerApproved(sellerId: string, email?: string | null) {
        return this.create({
            userId: sellerId,
            role: 'SELLER',
            type: 'SELLER_APPROVED',
            channel: 'EMAIL',
            content: 'Your seller account is approved',
            metadata: { sellerEmail: email },
            eventKey: `SELLER_APPROVED:${sellerId}`
        });
    }

    async notifySellerProductApproved(
        sellerId: string,
        productTitle: string,
        email?: string | null
    ) {
        return this.create({
            userId: sellerId,
            role: 'SELLER',
            type: 'SELLER_PRODUCT_APPROVED',
            channel: 'EMAIL',
            content: `Your product '${productTitle}' has been approved.`,
            metadata: { productTitle, email },
            eventKey: `SELLER_PRODUCT_APPROVED:${sellerId}:${productTitle}`
        });
    }

    async notifySellerProductRejected(
        sellerId: string,
        productTitle: string,
        reason: string,
        email?: string | null
    ) {
        return this.create({
            userId: sellerId,
            role: 'SELLER',
            type: 'SELLER_PRODUCT_REJECTED',
            channel: 'EMAIL',
            content: `Your product was rejected. Reason: ${reason}`,
            metadata: { productTitle, reason, email },
            eventKey: `SELLER_PRODUCT_REJECTED:${sellerId}:${productTitle}`
        });
    }

    /**
     * Trigger ADMIN_ALERT
     */
    async notifyAdmin(title: string, message: string) {
        return this.create({
            userId: null,
            role: 'ADMIN',
            type: 'ADMIN_ALERT',
            channel: 'EMAIL',
            content: title,
            metadata: { title, message }
        });
    }
}

export const notificationService = new NotificationService();
