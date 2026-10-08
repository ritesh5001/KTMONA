import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { getQueueRedisConnection } from './notification.queue.js';
import { notificationRepository } from './notification.repository.js';
import { sendEmail } from './email/resend.client.js';
import { orderPlacedTemplate } from './email/templates/order-placed.js';
import { shipmentCreatedTemplate } from './email/templates/shipment-created.js';
import { orderShippedTemplate } from './email/templates/order-shipped.js';
import { orderDeliveredTemplate } from './email/templates/order-delivered.js';
import { sellerNewOrderTemplate } from './email/templates/seller-new-order.js';
import { adminAlertTemplate } from './email/templates/admin-alert.js';
import { sellerApprovedTemplate } from './email/templates/seller-approved.js';
import { sellerProductApprovedTemplate } from './email/templates/seller-product-approved.js';
import { sellerProductRejectedTemplate } from './email/templates/seller-product-rejected.js';
import { paymentSuccessTemplate } from './email/templates/payment-success.js';
import { paymentFailedTemplate } from './email/templates/payment-failed.js';
export async function processNotificationJob(job) {
    console.log(`Job ${job.id} started. Notification: ${job.data.notificationId}`); // LOG START
    const { notificationId } = job.data;
    try {
        const notification = await notificationRepository.findById(notificationId);
        if (!notification) {
            console.error(`Notification ${notificationId} not found`);
            return;
        }
        if (notification.status === 'SENT') {
            console.log(`Notification ${notificationId} already sent. Skipping.`);
            return;
        }
        // Determine recipient email
        let to = null;
        // Priority 1: Metadata email (if exists)
        const meta = notification.metadata || {};
        if (meta.email) {
            to = meta.email;
        }
        // Priority 2: User from DB
        else if (notification.userId) {
            const user = await prisma.user.findUnique({ where: { id: notification.userId } });
            to = user?.email || null;
        }
        if (!to) {
            throw new Error(`No recipient email found for notification ${notificationId}`);
        }
        // Generate Email Content
        let emailData = null;
        switch (notification.type) {
            case 'ORDER_PLACED':
                emailData = orderPlacedTemplate(meta);
                break;
            case 'SHIPMENT_CREATED':
                emailData = shipmentCreatedTemplate(meta);
                break;
            case 'ORDER_SHIPPED':
                emailData = orderShippedTemplate(meta);
                break;
            case 'ORDER_DELIVERED':
                emailData = orderDeliveredTemplate(meta);
                break;
            case 'SELLER_NEW_ORDER':
                emailData = sellerNewOrderTemplate(meta);
                break;
            case 'SELLER_APPROVED':
                emailData = sellerApprovedTemplate(meta);
                break;
            case 'SELLER_PRODUCT_APPROVED':
                emailData = sellerProductApprovedTemplate(meta);
                break;
            case 'ADMIN_ALERT':
                emailData = adminAlertTemplate(meta);
                break;
            case 'SELLER_PRODUCT_REJECTED':
                emailData = sellerProductRejectedTemplate(meta);
                break;
            case 'PAYMENT_SUCCESS':
                emailData = paymentSuccessTemplate(meta);
                break;
            case 'PAYMENT_FAILED':
                emailData = paymentFailedTemplate(meta);
                break;
            default:
                throw new Error(`Unhandled notification type: ${notification.type}`);
        }
        // Send Email
        const result = await sendEmail(to, emailData.subject, emailData.html);
        // Update DB
        await notificationRepository.updateStatus(notificationId, 'SENT', new Date());
        await notificationRepository.createEvent(notificationId, 'RESEND', 'SENT', result.id);
        console.log(`Notification ${notificationId} sent to ${to}`);
    }
    catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        // Log failure event
        await notificationRepository.createEvent(notificationId, 'RESEND', 'FAILED', undefined, error.message);
        // Throw to trigger BullMQ retry
        throw error;
    }
}
export function createNotificationWorker(concurrency = 5) {
    if (!env.REDIS_URL) {
        console.warn('REDIS_URL is not set. Notification worker is disabled.');
        return null;
    }
    const connection = getQueueRedisConnection();
    if (!connection) {
        console.warn('Queue Redis connection unavailable. Notification worker is disabled.');
        return null;
    }
    const worker = new Worker('notification.queue', processNotificationJob, {
        connection,
        concurrency,
    });
    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} has failed with ${err.message}`);
    });
    return worker;
}
//# sourceMappingURL=notification.worker.js.map