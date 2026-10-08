import { CancellationStatus, NotificationChannel, NotificationType, OrderStatus, PaymentStatus, Role, SettlementStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { cancellationLogger } from '../config/logger.js';
import { orderCancelApprovedTotal, orderCancelRejectedTotal, orderCancelTotal, orderCancelRequestTotal, } from '../config/metrics.js';
import { ApiError } from '../errors/ApiError.js';
import { recordCancellationFatal } from '../monitoring/alerts.js';
import { notificationService } from '../notifications/notification.service.js';
import { refundService } from './refund.service.js';
import { CACHE_KEYS, getFromCache, invalidateCacheByPattern, setCache } from '../utils/cache.util.js';
const CANCELLATION_CACHE_TTL_SECONDS = 30;
function isOrderCancellable(status) {
    return status === OrderStatus.PLACED || status === OrderStatus.CONFIRMED;
}
export class CancellationService {
    isRetryableTransactionError(error) {
        const code = error?.code;
        const message = error instanceof Error ? error.message : String(error ?? '');
        return code === 'P2028' || message.includes('Transaction API error: Transaction not found');
    }
    async requestCancellation(userId, orderId, reason) {
        const normalizedReason = reason.trim();
        if (!normalizedReason) {
            throw ApiError.badRequest('Cancellation reason is required');
        }
        const order = await prisma.order.findFirst({
            where: { id: orderId, userId },
            select: { id: true, userId: true, status: true },
        });
        if (!order) {
            throw ApiError.notFound('Order not found');
        }
        if (!isOrderCancellable(order.status)) {
            if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
                recordCancellationFatal({
                    orderId,
                    userId,
                    reason: 'Cancellation attempted after shipment stage',
                });
            }
            throw ApiError.badRequest(`Order with status ${order.status} is not eligible for cancellation`);
        }
        const shipped = await prisma.shipments.findFirst({
            where: {
                order_id: orderId,
                status: 'SHIPPED',
            },
            select: { id: true },
        });
        if (shipped) {
            recordCancellationFatal({
                orderId,
                userId,
                reason: 'Cancellation attempted after shipment SHIPPED',
            });
            throw ApiError.badRequest('Order has already been shipped and cannot be cancelled');
        }
        const existing = await prisma.cancellationRequest.findUnique({
            where: { orderId },
            select: { id: true, status: true },
        });
        if (existing) {
            throw ApiError.conflict('Cancellation request already exists for this order', {
                cancellationId: existing.id,
                status: existing.status,
            });
        }
        const cancellation = await prisma.cancellationRequest.create({
            data: {
                orderId,
                userId,
                reason: normalizedReason,
                status: CancellationStatus.REQUESTED,
            },
            include: {
                order: { select: { id: true, userId: true, status: true } },
            },
        }).catch((error) => {
            // Handle race: concurrent duplicate cancellation requests
            if (error?.code === 'P2002' || String(error?.message ?? '').includes('Unique constraint')) {
                throw ApiError.conflict('Cancellation request already exists for this order');
            }
            throw error;
        });
        await notificationService.notifyAdmin('Cancellation request raised', `Buyer ${userId} requested cancellation for order ${orderId}`);
        orderCancelRequestTotal.inc();
        orderCancelTotal.inc();
        cancellationLogger.info({ orderId, userId, cancellationId: cancellation.id }, 'cancellation_requested');
        await Promise.allSettled([
            invalidateCacheByPattern(`cancellations:user:${userId}*`),
            invalidateCacheByPattern('cancellations:admin:*'),
            invalidateCacheByPattern(`orders:buyer:${userId}:*`),
        ]);
        return cancellation;
    }
    async getMyCancellations(userId) {
        const cacheKey = CACHE_KEYS.USER_CANCELLATIONS(userId);
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const cancellations = await prisma.cancellationRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: {
                order: {
                    select: {
                        id: true,
                        status: true,
                        totalAmount: true,
                        createdAt: true,
                    },
                },
            },
        });
        const response = {
            cancellations,
        };
        await setCache(cacheKey, response, CANCELLATION_CACHE_TTL_SECONDS);
        return response;
    }
    async listCancellations(filters) {
        const cacheKey = CACHE_KEYS.ADMIN_CANCELLATIONS(filters.status, filters.userId, filters.orderId);
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const cancellations = await prisma.cancellationRequest.findMany({
            where: {
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.userId ? { userId: filters.userId } : {}),
                ...(filters.orderId ? { orderId: filters.orderId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        user_profiles: {
                            select: { full_name: true },
                        },
                    },
                },
                order: {
                    select: {
                        id: true,
                        status: true,
                        totalAmount: true,
                        createdAt: true,
                        payment: {
                            select: {
                                status: true,
                            },
                        },
                    },
                },
            },
        });
        const response = { cancellations };
        await setCache(cacheKey, response, CANCELLATION_CACHE_TTL_SECONDS);
        return response;
    }
    async approveCancellation(adminId, cancellationId) {
        return this.approveCancellationInternal(adminId, cancellationId, 'ADMIN');
    }
    async approveCancellationBySeller(sellerId, cancellationId) {
        return this.approveCancellationInternal(sellerId, cancellationId, 'SELLER');
    }
    async approveCancellationInternal(reviewerId, cancellationId, reviewerType) {
        const runApprovalTransaction = async () => prisma.$transaction(async (tx) => {
            const cancellation = await tx.cancellationRequest.findUnique({
                where: { id: cancellationId },
                include: {
                    order: {
                        select: {
                            id: true,
                            userId: true,
                            status: true,
                            payment: {
                                select: {
                                    id: true,
                                    status: true,
                                },
                            },
                            items: {
                                select: {
                                    id: true,
                                    sellerId: true,
                                    variantId: true,
                                    quantity: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!cancellation) {
                throw ApiError.notFound('Cancellation request not found');
            }
            if (!cancellation.order) {
                recordCancellationFatal({
                    cancellationId,
                    adminId: reviewerId,
                    reason: 'Order not found during cancellation approval',
                });
                throw ApiError.notFound('Order not found for cancellation request');
            }
            const sellerIdsInOrder = new Set(cancellation.order.items.map((item) => item.sellerId));
            if (reviewerType === 'SELLER') {
                if (!sellerIdsInOrder.has(reviewerId)) {
                    throw ApiError.forbidden('You are not authorized to approve cancellation for this order');
                }
                if (sellerIdsInOrder.size > 1) {
                    throw ApiError.badRequest('Multi-seller order cancellation must be approved by admin');
                }
            }
            const liveOrder = await tx.order.findUnique({
                where: { id: cancellation.order.id },
                select: {
                    id: true,
                    status: true,
                    userId: true,
                    payment: {
                        select: {
                            status: true,
                        },
                    },
                },
            });
            if (!liveOrder) {
                recordCancellationFatal({
                    cancellationId,
                    orderId: cancellation.order.id,
                    adminId: reviewerId,
                    reason: 'Order not found during cancellation approval',
                });
                throw ApiError.notFound('Order not found');
            }
            if (liveOrder.status === OrderStatus.SHIPPED || liveOrder.status === OrderStatus.DELIVERED) {
                recordCancellationFatal({
                    cancellationId,
                    orderId: liveOrder.id,
                    adminId: reviewerId,
                    userId: liveOrder.userId,
                    reason: 'Cancellation attempted after shipped/delivered stage',
                });
                throw ApiError.badRequest(`Order with status ${liveOrder.status} cannot be cancelled`);
            }
            const shipped = await tx.shipments.findFirst({
                where: {
                    order_id: liveOrder.id,
                    status: 'SHIPPED',
                },
                select: { id: true },
            });
            if (shipped) {
                recordCancellationFatal({
                    cancellationId,
                    orderId: liveOrder.id,
                    adminId: reviewerId,
                    userId: liveOrder.userId,
                    reason: 'Cancellation approval attempted after shipment SHIPPED',
                });
                throw ApiError.badRequest('Order has already been shipped and cannot be cancelled');
            }
            if (cancellation.status === CancellationStatus.APPROVED || liveOrder.status === OrderStatus.CANCELLED) {
                if (cancellation.status !== CancellationStatus.APPROVED) {
                    await tx.cancellationRequest.update({
                        where: { id: cancellation.id },
                        data: {
                            status: CancellationStatus.APPROVED,
                            reviewedBy: reviewerId,
                            reviewedAt: new Date(),
                        },
                    });
                }
                return {
                    orderId: liveOrder.id,
                    userId: liveOrder.userId,
                    sellerIds: [],
                    paymentStatus: liveOrder.payment?.status ?? null,
                    alreadyCancelled: true,
                };
            }
            if (cancellation.status === CancellationStatus.REJECTED) {
                throw ApiError.conflict('Cannot approve a rejected cancellation request');
            }
            if (!isOrderCancellable(liveOrder.status)) {
                throw ApiError.badRequest(`Order with status ${liveOrder.status} is not eligible for cancellation`);
            }
            const approvalClaim = await tx.cancellationRequest.updateMany({
                where: {
                    id: cancellation.id,
                    status: CancellationStatus.REQUESTED,
                },
                data: {
                    status: CancellationStatus.APPROVED,
                    reviewedBy: reviewerId,
                    reviewedAt: new Date(),
                },
            });
            if (approvalClaim.count === 0) {
                const latestCancellation = await tx.cancellationRequest.findUnique({
                    where: { id: cancellation.id },
                    select: { status: true },
                });
                if (latestCancellation?.status === CancellationStatus.REJECTED) {
                    throw ApiError.conflict('Cannot approve a rejected cancellation request');
                }
                return {
                    orderId: liveOrder.id,
                    userId: liveOrder.userId,
                    sellerIds: [],
                    paymentStatus: liveOrder.payment?.status ?? null,
                    alreadyCancelled: true,
                };
            }
            const orderUpdate = await tx.order.updateMany({
                where: {
                    id: liveOrder.id,
                    status: {
                        in: [OrderStatus.PLACED, OrderStatus.CONFIRMED],
                    },
                },
                data: { status: OrderStatus.CANCELLED },
            });
            if (orderUpdate.count === 0) {
                const latestOrder = await tx.order.findUnique({
                    where: { id: liveOrder.id },
                    select: { status: true },
                });
                if (latestOrder?.status === OrderStatus.CANCELLED) {
                    return {
                        orderId: liveOrder.id,
                        userId: liveOrder.userId,
                        sellerIds: [],
                        paymentStatus: liveOrder.payment?.status ?? null,
                        alreadyCancelled: true,
                    };
                }
                throw ApiError.badRequest(`Order with status ${latestOrder?.status ?? 'UNKNOWN'} is not eligible for cancellation`);
            }
            const sellerIds = new Set();
            const restockByVariant = new Map();
            for (const item of cancellation.order.items) {
                sellerIds.add(item.sellerId);
                const currentQty = restockByVariant.get(item.variantId) ?? 0;
                restockByVariant.set(item.variantId, currentQty + item.quantity);
            }
            for (const [variantId, quantity] of restockByVariant) {
                try {
                    await tx.inventory.upsert({
                        where: { variantId },
                        update: { stock: { increment: quantity } },
                        create: {
                            variantId,
                            stock: quantity,
                        },
                    });
                }
                catch (error) {
                    recordCancellationFatal({
                        cancellationId,
                        orderId: liveOrder.id,
                        adminId: reviewerId,
                        reason: `Inventory restore failed for variant ${variantId}`,
                    });
                    throw ApiError.internal(`Failed to restore inventory for variant ${variantId}`);
                }
            }
            if (restockByVariant.size > 0) {
                await tx.inventoryMovement.createMany({
                    data: Array.from(restockByVariant.entries()).map(([variantId, quantity]) => ({
                        variantId,
                        orderId: liveOrder.id,
                        quantity,
                        type: 'RELEASE',
                        reason: 'CANCELLATION',
                    })),
                    skipDuplicates: true,
                });
            }
            // Void seller settlements so cancelled revenue is excluded from analytics
            await tx.sellerSettlement.updateMany({
                where: {
                    orderId: liveOrder.id,
                    status: { not: SettlementStatus.CANCELLED },
                },
                data: { status: SettlementStatus.CANCELLED },
            });
            return {
                orderId: liveOrder.id,
                userId: liveOrder.userId,
                sellerIds: Array.from(sellerIds),
                paymentStatus: liveOrder.payment?.status ?? null,
                alreadyCancelled: false,
            };
        }, {
            maxWait: 10_000,
            timeout: 30_000,
        });
        let txResult;
        try {
            txResult = await runApprovalTransaction();
        }
        catch (error) {
            if (!this.isRetryableTransactionError(error)) {
                throw error;
            }
            cancellationLogger.warn({
                cancellationId,
                reviewerId,
                reviewerType,
                reason: error instanceof Error ? error.message : String(error),
            }, 'approve_cancellation_retrying_transaction');
            txResult = await runApprovalTransaction();
        }
        let refundTriggered = false;
        if (txResult.paymentStatus === PaymentStatus.SUCCESS) {
            try {
                const orderForRefund = await prisma.order.findUnique({
                    where: { id: txResult.orderId },
                    select: { totalAmount: true },
                });
                const amountPaise = Math.round((orderForRefund?.totalAmount ?? 0) * 100);
                await refundService.createRefund({
                    orderId: txResult.orderId,
                    amount: amountPaise,
                    reason: 'Order cancelled',
                    initiatedBy: 'SYSTEM',
                });
                refundTriggered = true;
            }
            catch (error) {
                recordCancellationFatal({
                    cancellationId,
                    orderId: txResult.orderId,
                    adminId: reviewerId,
                    userId: txResult.userId,
                    reason: 'Refund API failed during cancellation approval',
                });
                throw error;
            }
        }
        await notificationService.create({
            userId: txResult.userId,
            role: Role.USER,
            type: NotificationType.ADMIN_ALERT,
            channel: NotificationChannel.EMAIL,
            content: reviewerType === 'SELLER'
                ? `Cancellation approved by seller for order #${txResult.orderId}`
                : `Cancellation approved for order #${txResult.orderId}`,
            metadata: { orderId: txResult.orderId, status: 'APPROVED' },
            eventKey: `CANCELLATION_APPROVED:${txResult.orderId}`,
        });
        if (reviewerType === 'ADMIN') {
            for (const sellerId of txResult.sellerIds) {
                await notificationService.create({
                    userId: sellerId,
                    role: Role.SELLER,
                    type: NotificationType.ADMIN_ALERT,
                    channel: NotificationChannel.EMAIL,
                    content: `Order #${txResult.orderId} has been cancelled by admin approval`,
                    metadata: { orderId: txResult.orderId, status: 'CANCELLED' },
                    eventKey: `SELLER_ORDER_CANCELLED:${txResult.orderId}:${sellerId}`,
                });
            }
        }
        orderCancelApprovedTotal.inc();
        cancellationLogger.info({
            orderId: txResult.orderId,
            userId: txResult.userId,
            adminId: reviewerId,
            reviewerType,
            paymentStatus: txResult.paymentStatus,
            refundTriggered,
            alreadyCancelled: txResult.alreadyCancelled,
        }, 'cancellation_approved');
        await Promise.allSettled([
            invalidateCacheByPattern(`cancellations:user:${txResult.userId}*`),
            invalidateCacheByPattern('cancellations:admin:*'),
            invalidateCacheByPattern(`orders:buyer:${txResult.userId}:*`),
            ...txResult.sellerIds.map((sellerId) => invalidateCacheByPattern(`orders:seller:${sellerId}:*`)),
            ...txResult.sellerIds.map((sellerId) => invalidateCacheByPattern(`seller:analytics:*:${sellerId}:*`)),
        ]);
        return {
            success: true,
            orderId: txResult.orderId,
            paymentStatus: txResult.paymentStatus,
            refundTriggered,
            alreadyCancelled: txResult.alreadyCancelled,
        };
    }
    async rejectCancellation(adminId, cancellationId, reason) {
        const existing = await prisma.cancellationRequest.findUnique({
            where: { id: cancellationId },
            include: {
                order: {
                    select: {
                        id: true,
                        userId: true,
                    },
                },
            },
        });
        if (!existing) {
            throw ApiError.notFound('Cancellation request not found');
        }
        if (existing.status === CancellationStatus.APPROVED) {
            throw ApiError.conflict('Cannot reject an approved cancellation request');
        }
        if (existing.status === CancellationStatus.REJECTED) {
            return {
                success: true,
                cancellationId: existing.id,
                orderId: existing.orderId,
                alreadyRejected: true,
            };
        }
        const updated = await prisma.cancellationRequest.update({
            where: { id: cancellationId },
            data: {
                status: CancellationStatus.REJECTED,
                reviewedBy: adminId,
                reviewedAt: new Date(),
                rejectionReason: reason?.trim() || null,
            },
        });
        await notificationService.create({
            userId: existing.order.userId,
            role: Role.USER,
            type: NotificationType.ADMIN_ALERT,
            channel: NotificationChannel.EMAIL,
            content: `Cancellation rejected for order #${existing.order.id}`,
            metadata: {
                orderId: existing.order.id,
                status: 'REJECTED',
                reason: updated.rejectionReason,
            },
            eventKey: `CANCELLATION_REJECTED:${existing.order.id}`,
        });
        orderCancelRejectedTotal.inc();
        cancellationLogger.info({
            orderId: existing.order.id,
            userId: existing.order.userId,
            adminId,
            paymentStatus: null,
            refundTriggered: false,
        }, 'cancellation_rejected');
        await Promise.allSettled([
            invalidateCacheByPattern(`cancellations:user:${existing.order.userId}*`),
            invalidateCacheByPattern('cancellations:admin:*'),
            invalidateCacheByPattern(`orders:buyer:${existing.order.userId}:*`),
        ]);
        return {
            success: true,
            cancellationId: updated.id,
            orderId: existing.order.id,
            alreadyRejected: false,
        };
    }
}
export const cancellationService = new CancellationService();
//# sourceMappingURL=cancellation.service.js.map