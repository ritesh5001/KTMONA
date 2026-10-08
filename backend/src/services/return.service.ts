import {
    NotificationChannel,
    NotificationType,
    OrderStatus,
    PaymentStatus,
    ReturnStatus,
    Role,
} from '@prisma/client';
import { prisma } from '../config/db.js';
import { returnLogger } from '../config/logger.js';
import {
    returnRequestTotal,
    returnApprovedTotal,
    returnRejectedTotal,
    returnRefundedTotal,
    returnProcessingTimeMs,
} from '../config/metrics.js';
import { ApiError } from '../errors/ApiError.js';
import { recordReturnFatal } from '../monitoring/alerts.js';
import { notificationService } from '../notifications/notification.service.js';
import { refundService } from './refund.service.js';
import { CACHE_KEYS, getFromCache, invalidateCacheByPattern, setCache } from '../utils/cache.util.js';

/** Maximum days after delivery that a return can be requested. */
const RETURN_WINDOW_DAYS = 7;
const RETURN_CACHE_TTL_SECONDS = 30;

interface ReturnItemInput {
    orderItemId: string;
    quantity: number;
    reason?: string | undefined;
}

export class ReturnService {
    // ------------------------------------------------------------------
    // Buyer: Request Return
    // ------------------------------------------------------------------

    async requestReturn(userId: string, orderId: string, reason: string, items: ReturnItemInput[]) {
        const normalizedReason = reason.trim();
        if (!normalizedReason) {
            throw ApiError.badRequest('Return reason is required');
        }
        if (!items.length) {
            throw ApiError.badRequest('At least one item must be specified for return');
        }

        const order = await prisma.order.findFirst({
            where: { id: orderId, userId },
            select: {
                id: true,
                userId: true,
                status: true,
                items: {
                    select: {
                        id: true,
                        variantId: true,
                        quantity: true,
                        priceSnapshot: true,
                    },
                },
                shipments: {
                    where: { status: 'DELIVERED' },
                    select: { delivered_at: true },
                    orderBy: { delivered_at: 'desc' },
                    take: 1,
                },
            },
        });

        if (!order) {
            throw ApiError.notFound('Order not found');
        }

        if (order.status !== OrderStatus.DELIVERED) {
            throw ApiError.badRequest(`Order with status ${order.status} is not eligible for return. Only DELIVERED orders can be returned.`);
        }

        // 7-day return window check using shipment delivered_at
        const deliveredShipment = order.shipments[0];
        if (!deliveredShipment?.delivered_at) {
            recordReturnFatal({
                orderId,
                userId,
                reason: 'Order status is DELIVERED but no delivered shipment found',
            });
            throw ApiError.badRequest('Could not determine delivery date for this order');
        }

        const deliveredAt = new Date(deliveredShipment.delivered_at);
        const cutoff = new Date(deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        if (new Date() > cutoff) {
            throw ApiError.badRequest(
                `Return window has expired. Returns must be requested within ${RETURN_WINDOW_DAYS} days of delivery.`,
            );
        }

        // Validate each item belongs to the order and quantity is valid
        const orderItemMap = new Map(order.items.map((item) => [item.id, item]));
        const returnItemsData: Array<{
            orderItemId: string;
            variantId: string;
            quantity: number;
            reason: string | null;
        }> = [];

        for (const reqItem of items) {
            const orderItem = orderItemMap.get(reqItem.orderItemId);
            if (!orderItem) {
                throw ApiError.badRequest(`Order item ${reqItem.orderItemId} does not belong to this order`);
            }
            if (reqItem.quantity < 1 || reqItem.quantity > orderItem.quantity) {
                throw ApiError.badRequest(
                    `Invalid return quantity ${reqItem.quantity} for order item ${reqItem.orderItemId} (purchased: ${orderItem.quantity})`,
                );
            }
            returnItemsData.push({
                orderItemId: reqItem.orderItemId,
                variantId: orderItem.variantId,
                quantity: reqItem.quantity,
                reason: reqItem.reason?.trim() || null,
            });
        }

        // Check for existing open return request on same order
        const existingOpen = await prisma.returnRequest.findFirst({
            where: {
                orderId,
                status: { in: [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.INSPECTING] },
            },
            select: { id: true, status: true },
        });

        if (existingOpen) {
            throw ApiError.conflict('An active return request already exists for this order', {
                returnId: existingOpen.id,
                status: existingOpen.status,
            });
        }

        // Calculate refund amount from item-level price snapshots
        let refundAmount = 0;
        for (const ri of returnItemsData) {
            const orderItem = orderItemMap.get(ri.orderItemId)!;
            refundAmount += orderItem.priceSnapshot * ri.quantity;
        }

        const returnRequest = await prisma.returnRequest.create({
            data: {
                orderId,
                userId,
                reason: normalizedReason,
                status: ReturnStatus.REQUESTED,
                refundAmount,
                items: {
                    create: returnItemsData.map((ri) => ({
                        orderItemId: ri.orderItemId,
                        variantId: ri.variantId,
                        quantity: ri.quantity,
                        reason: ri.reason,
                    })),
                },
            },
            include: {
                items: true,
            },
        });

        await notificationService.notifyAdmin(
            'Return request raised',
            `Buyer ${userId} requested return for order ${orderId} (${items.length} item(s), refund ₹${refundAmount})`,
        );

        returnRequestTotal.inc();
        returnLogger.info(
            { orderId, userId, returnId: returnRequest.id, refundAmount, itemCount: items.length },
            'return_requested',
        );
        await Promise.allSettled([
            invalidateCacheByPattern(`returns:user:${userId}*`),
            invalidateCacheByPattern('returns:admin:*'),
            invalidateCacheByPattern(`orders:buyer:${userId}:*`),
        ]);

        return returnRequest;
    }

    // ------------------------------------------------------------------
    // Buyer: List My Returns
    // ------------------------------------------------------------------

    async getMyReturns(userId: string) {
        const cacheKey = CACHE_KEYS.USER_RETURNS(userId);
        const cached = await getFromCache<{ returns: unknown[] }>(cacheKey);
        if (cached) return cached;

        const returns = await prisma.returnRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: {
                items: true,
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

        const response = { returns };
        await setCache(cacheKey, response, RETURN_CACHE_TTL_SECONDS);
        return response;
    }

    // ------------------------------------------------------------------
    // Buyer: Get Single Return
    // ------------------------------------------------------------------

    async getReturnById(userId: string, returnId: string) {
        const returnReq = await prisma.returnRequest.findFirst({
            where: { id: returnId, userId },
            include: {
                items: {
                    include: {
                        orderItem: {
                            select: {
                                id: true,
                                productId: true,
                                variantId: true,
                                quantity: true,
                                priceSnapshot: true,
                            },
                        },
                    },
                },
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

        if (!returnReq) {
            throw ApiError.notFound('Return request not found');
        }

        return returnReq;
    }

    // ------------------------------------------------------------------
    // Admin: List Returns
    // ------------------------------------------------------------------

    async listReturns(filters: {
        status?: ReturnStatus;
        userId?: string;
        orderId?: string;
    }) {
        const cacheKey = CACHE_KEYS.ADMIN_RETURNS(filters.status, filters.userId, filters.orderId);
        const cached = await getFromCache<{ returns: unknown[] }>(cacheKey);
        if (cached) return cached;

        const returns = await prisma.returnRequest.findMany({
            where: {
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.userId ? { userId: filters.userId } : {}),
                ...(filters.orderId ? { orderId: filters.orderId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                items: true,
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
                            select: { status: true },
                        },
                    },
                },
            },
        });

        const response = { returns };
        await setCache(cacheKey, response, RETURN_CACHE_TTL_SECONDS);
        return response;
    }

    // ------------------------------------------------------------------
    // Admin: Approve Return (restocks inventory)
    // ------------------------------------------------------------------

    async approveReturn(adminId: string, returnId: string) {
        const txResult = await prisma.$transaction(async (tx) => {
            const returnReq = await tx.returnRequest.findUnique({
                where: { id: returnId },
                include: {
                    items: true,
                    order: {
                        select: {
                            id: true,
                            userId: true,
                            status: true,
                            items: {
                                select: {
                                    id: true,
                                    sellerId: true,
                                    variantId: true,
                                    quantity: true,
                                },
                            },
                            payment: {
                                select: {
                                    id: true,
                                    status: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!returnReq) {
                throw ApiError.notFound('Return request not found');
            }

            if (!returnReq.order) {
                recordReturnFatal({
                    returnId,
                    adminId,
                    reason: 'Order not found during return approval',
                });
                throw ApiError.notFound('Order not found for return request');
            }

            // Row lock for concurrency safety
            await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${returnReq.order.id} FOR UPDATE`;

            if (returnReq.status === ReturnStatus.APPROVED || returnReq.status === ReturnStatus.INSPECTING) {
                return {
                    orderId: returnReq.order.id,
                    userId: returnReq.order.userId,
                    sellerIds: [] as string[],
                    paymentStatus: returnReq.order.payment?.status ?? null,
                    alreadyApproved: true,
                };
            }

            if (returnReq.status === ReturnStatus.REJECTED) {
                throw ApiError.conflict('Cannot approve a rejected return request');
            }

            if (returnReq.status === ReturnStatus.REFUNDED) {
                throw ApiError.conflict('Return has already been refunded');
            }

            if (returnReq.status !== ReturnStatus.REQUESTED) {
                throw ApiError.badRequest(`Return with status ${returnReq.status} cannot be approved`);
            }

            // Restock inventory for each return item
            const sellerIds = new Set<string>();
            for (const returnItem of returnReq.items) {
                const orderItem = returnReq.order.items.find((oi) => oi.id === returnItem.orderItemId);
                if (orderItem) {
                    sellerIds.add(orderItem.sellerId);

                    try {
                        await tx.inventory.upsert({
                            where: { variantId: returnItem.variantId },
                            update: { stock: { increment: returnItem.quantity } },
                            create: {
                                variantId: returnItem.variantId,
                                stock: returnItem.quantity,
                            },
                        });
                    } catch (error) {
                        recordReturnFatal({
                            returnId,
                            orderId: returnReq.order.id,
                            adminId,
                            reason: `Inventory restore failed for variant ${returnItem.variantId}`,
                        });
                        throw ApiError.internal(`Failed to restore inventory for variant ${returnItem.variantId}`);
                    }

                    // Create RELEASE movement for return (use createMany + skipDuplicates for idempotency)
                    await tx.inventoryMovement.createMany({
                        data: [
                            {
                                variantId: returnItem.variantId,
                                orderId: returnReq.order.id,
                                quantity: returnItem.quantity,
                                type: 'RELEASE',
                                reason: 'RETURN',
                            },
                        ],
                        skipDuplicates: true,
                    });
                }
            }

            await tx.returnRequest.update({
                where: { id: returnId },
                data: {
                    status: ReturnStatus.APPROVED,
                    reviewedBy: adminId,
                    reviewedAt: new Date(),
                },
            });

            return {
                orderId: returnReq.order.id,
                userId: returnReq.order.userId,
                sellerIds: Array.from(sellerIds),
                paymentStatus: returnReq.order.payment?.status ?? null,
                alreadyApproved: false,
            };
        });

        // Notifications (outside tx for performance)
        await notificationService.create({
            userId: txResult.userId,
            role: Role.USER,
            type: NotificationType.ADMIN_ALERT,
            channel: NotificationChannel.EMAIL,
            content: `Return approved for order #${txResult.orderId}. Inspection may follow before refund.`,
            metadata: { orderId: txResult.orderId, status: 'APPROVED' },
            eventKey: `RETURN_APPROVED:${txResult.orderId}:${returnId}`,
        });

        for (const sellerId of txResult.sellerIds) {
            await notificationService.create({
                userId: sellerId,
                role: Role.SELLER,
                type: NotificationType.ADMIN_ALERT,
                channel: NotificationChannel.EMAIL,
                content: `Return approved for order #${txResult.orderId}. Inventory restocked.`,
                metadata: { orderId: txResult.orderId, status: 'RETURN_APPROVED' },
                eventKey: `SELLER_RETURN_APPROVED:${txResult.orderId}:${sellerId}:${returnId}`,
            });
        }

        returnApprovedTotal.inc();
        returnLogger.info(
            { orderId: txResult.orderId, userId: txResult.userId, adminId, returnId, alreadyApproved: txResult.alreadyApproved },
            'return_approved',
        );
        await Promise.allSettled([
            invalidateCacheByPattern(`returns:user:${txResult.userId}*`),
            invalidateCacheByPattern('returns:admin:*'),
            invalidateCacheByPattern(`orders:buyer:${txResult.userId}:*`),
            ...txResult.sellerIds.map((sellerId) => invalidateCacheByPattern(`orders:seller:${sellerId}:*`)),
            ...txResult.sellerIds.map((sellerId) => invalidateCacheByPattern(`seller:analytics:*:${sellerId}:*`)),
        ]);

        return {
            success: true,
            orderId: txResult.orderId,
            paymentStatus: txResult.paymentStatus,
            alreadyApproved: txResult.alreadyApproved,
        };
    }

    // ------------------------------------------------------------------
    // Admin: Reject Return
    // ------------------------------------------------------------------

    async rejectReturn(adminId: string, returnId: string, reason?: string) {
        const existing = await prisma.returnRequest.findUnique({
            where: { id: returnId },
            include: {
                order: {
                    select: { id: true, userId: true },
                },
            },
        });

        if (!existing) {
            throw ApiError.notFound('Return request not found');
        }

        if (existing.status === ReturnStatus.APPROVED || existing.status === ReturnStatus.REFUNDED) {
            throw ApiError.conflict('Cannot reject an approved or refunded return request');
        }

        if (existing.status === ReturnStatus.REJECTED) {
            return {
                success: true,
                returnId: existing.id,
                orderId: existing.orderId,
                alreadyRejected: true,
            };
        }

        const updated = await prisma.returnRequest.update({
            where: { id: returnId },
            data: {
                status: ReturnStatus.REJECTED,
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
            content: `Return rejected for order #${existing.order.id}`,
            metadata: {
                orderId: existing.order.id,
                status: 'REJECTED',
                reason: updated.rejectionReason,
            },
            eventKey: `RETURN_REJECTED:${existing.order.id}:${returnId}`,
        });

        returnRejectedTotal.inc();
        returnLogger.info(
            { orderId: existing.order.id, userId: existing.order.userId, adminId, returnId },
            'return_rejected',
        );
        await Promise.allSettled([
            invalidateCacheByPattern(`returns:user:${existing.order.userId}*`),
            invalidateCacheByPattern('returns:admin:*'),
            invalidateCacheByPattern(`orders:buyer:${existing.order.userId}:*`),
        ]);

        return {
            success: true,
            returnId: updated.id,
            orderId: existing.order.id,
            alreadyRejected: false,
        };
    }

    // ------------------------------------------------------------------
    // Admin: Process Refund for an approved return
    // ------------------------------------------------------------------

    async processReturnRefund(adminId: string, returnId: string) {
        const startMs = Date.now();

        const txResult = await prisma.$transaction(async (tx) => {
            const returnReq = await tx.returnRequest.findUnique({
                where: { id: returnId },
                include: {
                    items: {
                        include: {
                            orderItem: {
                                select: {
                                    sellerId: true,
                                    quantity: true,
                                    sellerPriceSnapshot: true,
                                },
                            },
                        },
                    },
                    order: {
                        select: {
                            id: true,
                            userId: true,
                            payment: {
                                select: { id: true, status: true },
                            },
                        },
                    },
                },
            });

            if (!returnReq) {
                throw ApiError.notFound('Return request not found');
            }

            // Row lock
            await tx.$queryRaw`SELECT id FROM "return_requests" WHERE id = ${returnId} FOR UPDATE`;

            // Re-read after lock
            const locked = await tx.returnRequest.findUnique({
                where: { id: returnId },
                select: { id: true, status: true, refundAmount: true, orderId: true },
            });

            if (!locked) {
                throw ApiError.notFound('Return request not found after lock');
            }

            if (locked.status === ReturnStatus.REFUNDED) {
                return { alreadyRefunded: true, orderId: locked.orderId, userId: returnReq.order.userId };
            }

            if (locked.status !== ReturnStatus.APPROVED && locked.status !== ReturnStatus.INSPECTING) {
                throw ApiError.badRequest(`Return with status ${locked.status} cannot be refunded. Must be APPROVED or INSPECTING.`);
            }

            await tx.returnRequest.update({
                where: { id: returnId },
                data: { status: ReturnStatus.REFUNDED },
            });

            // Reduce seller settlement amounts to reflect the return refund
            // For full-order returns this effectively zeros the settlements
            if (locked.refundAmount && locked.refundAmount > 0) {
                const settlements = await tx.sellerSettlement.findMany({
                    where: { orderId: locked.orderId },
                    select: { id: true, sellerId: true, grossAmount: true, netAmount: true, commissionAmount: true, platformFee: true },
                });

                const sellerRefundMap = new Map<string, number>();
                for (const returnItem of returnReq.items) {
                    const sellerId = returnItem.orderItem.sellerId;
                    const sellerRefund =
                        (returnItem.orderItem.sellerPriceSnapshot ?? 0) * returnItem.quantity;
                    sellerRefundMap.set(sellerId, (sellerRefundMap.get(sellerId) ?? 0) + sellerRefund);
                }

                for (const s of settlements) {
                    const targetRefund = sellerRefundMap.get(s.sellerId) ?? 0;
                    if (targetRefund <= 0) continue;
                    const deduction = Math.min(targetRefund, s.grossAmount);
                    const ratio = s.grossAmount > 0 ? (s.grossAmount - deduction) / s.grossAmount : 0;
                    await tx.sellerSettlement.update({
                        where: { id: s.id },
                        data: {
                            grossAmount: Math.round((s.grossAmount - deduction) * 100) / 100,
                            commissionAmount: Math.round(s.commissionAmount * ratio * 100) / 100,
                            netAmount: Math.round(s.netAmount * ratio * 100) / 100,
                        },
                    });
                }
            }

            return {
                alreadyRefunded: false,
                orderId: locked.orderId,
                userId: returnReq.order.userId,
                refundAmount: locked.refundAmount,
                paymentStatus: returnReq.order.payment?.status ?? null,
            };
        });

        if (txResult.alreadyRefunded) {
            returnLogger.info({ returnId, adminId }, 'return_refund_already_processed');
            return { success: true, returnId, alreadyRefunded: true };
        }

        // Trigger actual refund via refund ledger (outside tx)
        let refundTriggered = false;
        if (txResult.paymentStatus === PaymentStatus.SUCCESS || txResult.paymentStatus === PaymentStatus.REFUNDED) {
            try {
                const amountPaise = Math.round((txResult.refundAmount ?? 0) * 100);
                await refundService.createRefund({
                    orderId: txResult.orderId,
                    amount: amountPaise,
                    reason: 'Return approved',
                    initiatedBy: 'ADMIN',
                });
                refundTriggered = true;
            } catch (error) {
                recordReturnFatal({
                    returnId,
                    orderId: txResult.orderId,
                    adminId,
                    userId: txResult.userId,
                    reason: 'Refund API failed during return refund processing',
                });
                throw error;
            }
        }

        await notificationService.create({
            userId: txResult.userId,
            role: Role.USER,
            type: NotificationType.ADMIN_ALERT,
            channel: NotificationChannel.EMAIL,
            content: `Refund processed for return on order #${txResult.orderId}. Amount: ₹${txResult.refundAmount ?? 0}`,
            metadata: { orderId: txResult.orderId, refundAmount: txResult.refundAmount, status: 'REFUNDED' },
            eventKey: `RETURN_REFUNDED:${txResult.orderId}:${returnId}`,
        });

        returnRefundedTotal.inc();
        const elapsedMs = Date.now() - startMs;
        returnProcessingTimeMs.observe(elapsedMs);
        returnLogger.info(
            { orderId: txResult.orderId, userId: txResult.userId, adminId, returnId, refundTriggered, elapsedMs },
            'return_refund_processed',
        );
        await Promise.allSettled([
            invalidateCacheByPattern(`returns:user:${txResult.userId}*`),
            invalidateCacheByPattern('returns:admin:*'),
            invalidateCacheByPattern(`orders:buyer:${txResult.userId}:*`),
            invalidateCacheByPattern('seller:analytics:*'),
        ]);

        return { success: true, returnId, refundTriggered, alreadyRefunded: false };
    }
}

export const returnService = new ReturnService();
