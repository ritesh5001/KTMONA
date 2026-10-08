import { prisma } from '../config/db.js';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
function resolvePagination(page, limit) {
    const pRaw = Number(page ?? 1);
    const lRaw = Number(limit ?? DEFAULT_LIMIT);
    const p = Number.isFinite(pRaw) && pRaw > 0 ? Math.trunc(pRaw) : 1;
    const l = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(lRaw) ? Math.trunc(lRaw) : DEFAULT_LIMIT));
    return { skip: (p - 1) * l, take: l };
}
/**
 * Order Repository
 * Handles database operations for orders
 */
export class OrderRepository {
    /**
     * Create order with items (used within transaction)
     */
    async create(data) {
        return prisma.order.create({
            data: {
                userId: data.userId,
                totalAmount: data.totalAmount,
                items: {
                    create: data.items.map((item) => ({
                        sellerId: item.sellerId,
                        productId: item.productId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                        priceSnapshot: item.priceSnapshot,
                        sellerPriceSnapshot: item.sellerPriceSnapshot,
                        adminPriceSnapshot: item.adminPriceSnapshot,
                        platformMargin: item.platformMargin,
                    })),
                },
            },
            include: {
                items: true,
            },
        });
    }
    /**
     * Find order by ID
     */
    async findById(id) {
        return prisma.order.findUnique({
            where: { id },
        });
    }
    /**
     * Find order by ID and user ID (buyer ownership check)
     */
    async findByIdAndUserId(id, userId) {
        const order = await prisma.order.findFirst({
            where: { id, userId },
            include: {
                items: true,
                movements: true,
                payment: {
                    select: {
                        status: true,
                    },
                },
                cancellationRequest: {
                    select: {
                        status: true,
                    },
                },
                returnRequests: {
                    select: {
                        status: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                shipments: {
                    select: {
                        status: true,
                        created_at: true,
                    },
                    orderBy: { created_at: 'desc' },
                    take: 1,
                },
            },
        });
        if (!order) {
            return null;
        }
        // Enhance with product/variant details
        const itemsWithDetails = await this.enrichOrderItems(order.items);
        return {
            ...order,
            items: itemsWithDetails,
            paymentStatus: order.payment?.status ?? null,
            cancellationStatus: order.cancellationRequest?.status ?? null,
            returnStatus: order.returnRequests[0]?.status ?? null,
            shipmentStatus: order.shipments[0]?.status ?? null,
        };
    }
    /**
     * Find all orders for a user (buyer)
     */
    async findByUserId(userId, params) {
        const { skip, take } = resolvePagination(params?.page, params?.limit);
        const createdAtFilter = params?.startDate || params?.endDate
            ? {
                ...(params.startDate ? { gte: params.startDate } : {}),
                ...(params.endDate ? { lte: params.endDate } : {}),
            }
            : undefined;
        const orders = await prisma.order.findMany({
            where: {
                userId,
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
            },
            include: {
                items: true,
                payment: {
                    select: {
                        status: true,
                    },
                },
                cancellationRequest: {
                    select: {
                        id: true,
                        status: true,
                    },
                },
                returnRequests: {
                    select: {
                        id: true,
                        status: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                shipments: {
                    select: {
                        status: true,
                        created_at: true,
                    },
                    orderBy: { created_at: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        });
        // One batched lookup for the products across every order on this page, so
        // the buyer's order list can show a title and thumbnail per line without an
        // N+1. Two extra queries total, regardless of order count.
        const productIds = [
            ...new Set(orders.flatMap((order) => order.items.map((item) => item.productId))),
        ];
        const variantIds = [
            ...new Set(orders.flatMap((order) => order.items.map((item) => item.variantId))),
        ];
        const [products, variants] = await Promise.all([
            productIds.length
                ? prisma.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, title: true, images: true },
                })
                : Promise.resolve([]),
            variantIds.length
                ? prisma.productVariant.findMany({
                    where: { id: { in: variantIds } },
                    select: { id: true, size: true, sku: true, color: true, images: true },
                })
                : Promise.resolve([]),
        ]);
        const productMap = new Map(products.map((p) => [p.id, p]));
        const variantMap = new Map(variants.map((v) => [v.id, v]));
        return orders.map((order) => {
            const latestShipmentStatus = order.shipments[0]?.status ?? null;
            return {
                ...order,
                items: order.items.map((item) => {
                    const product = productMap.get(item.productId);
                    const variant = variantMap.get(item.variantId);
                    return {
                        ...item,
                        productTitle: product?.title ?? null,
                        productImage: variant?.images?.[0] ?? product?.images?.[0] ?? null,
                        variantSize: variant?.size ?? null,
                        variantSku: variant?.sku ?? null,
                        variantColor: variant?.color ?? null,
                    };
                }),
                paymentStatus: order.payment?.status ?? null,
                cancellationStatus: order.cancellationRequest?.status ?? null,
                returnStatus: order.returnRequests[0]?.status ?? null,
                shipmentStatus: latestShipmentStatus,
            };
        });
    }
    /**
     * Find order items for a seller
     * Uses batch lookups instead of N+1 queries
     */
    async findBySellerId(sellerId, params) {
        const { skip, take } = resolvePagination(params?.page, params?.limit);
        const createdAtFilter = params?.startDate || params?.endDate
            ? {
                ...(params.startDate ? { gte: params.startDate } : {}),
                ...(params.endDate ? { lte: params.endDate } : {}),
            }
            : undefined;
        const orderItems = await prisma.orderItem.findMany({
            where: {
                sellerId,
                ...(createdAtFilter ? { order: { createdAt: createdAtFilter } } : {}),
            },
            include: {
                order: {
                    select: {
                        id: true,
                        status: true,
                        createdAt: true,
                        shipments: {
                            select: {
                                status: true,
                                created_at: true,
                            },
                            orderBy: { created_at: 'desc' },
                            take: 1,
                        },
                        cancellationRequest: {
                            select: {
                                id: true,
                                status: true,
                                reason: true,
                                createdAt: true,
                            },
                        },
                        shippingName: true,
                        shippingPhone: true,
                        shippingEmail: true,
                        shippingAddressLine1: true,
                        shippingAddressLine2: true,
                        shippingCity: true,
                        shippingPincode: true,
                        shippingNotes: true,
                    },
                },
            },
            orderBy: { order: { createdAt: 'desc' } },
            skip,
            take,
        });
        // Batch lookup instead of N+1
        const productIds = [...new Set(orderItems.map((i) => i.productId))];
        const variantIds = [...new Set(orderItems.map((i) => i.variantId))];
        const [products, variants] = await Promise.all([
            productIds.length
                ? prisma.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, title: true },
                })
                : [],
            variantIds.length
                ? prisma.productVariant.findMany({
                    where: { id: { in: variantIds } },
                    select: { id: true, sku: true },
                })
                : [],
        ]);
        const productMap = new Map(products.map((p) => [p.id, p.title]));
        const variantMap = new Map(variants.map((v) => [v.id, v.sku]));
        return orderItems.map((item) => ({
            ...item,
            order: {
                ...item.order,
                shipmentStatus: item.order.shipments[0]?.status ?? null,
            },
            productTitle: productMap.get(item.productId),
            variantSku: variantMap.get(item.variantId),
        }));
    }
    /**
     * Find order items for a specific order belonging to seller
     */
    async findSellerOrderById(orderId, sellerId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                createdAt: true,
                shippingName: true,
                shippingPhone: true,
                shippingEmail: true,
                shippingAddressLine1: true,
                shippingAddressLine2: true,
                shippingCity: true,
                shippingPincode: true,
                shippingNotes: true,
            },
        });
        if (!order) {
            return { order: null, items: [] };
        }
        const items = await prisma.orderItem.findMany({
            where: { orderId, sellerId },
        });
        const itemsWithDetails = await this.enrichOrderItems(items);
        return { order, items: itemsWithDetails };
    }
    /**
     * Helper to enrich order items with product/variant details
     * Uses batch lookups (2 queries total) instead of 2N individual queries.
     */
    async enrichOrderItems(items) {
        if (items.length === 0)
            return [];
        const productIds = [...new Set(items.map((i) => i.productId))];
        const variantIds = [...new Set(items.map((i) => i.variantId))];
        const [products, variants] = await Promise.all([
            prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, title: true },
            }),
            prisma.productVariant.findMany({
                where: { id: { in: variantIds } },
                select: { id: true, sku: true },
            }),
        ]);
        const productMap = new Map(products.map((p) => [p.id, p.title]));
        const variantMap = new Map(variants.map((v) => [v.id, v.sku]));
        return items.map((item) => ({
            ...item,
            productTitle: productMap.get(item.productId),
            variantSku: variantMap.get(item.variantId),
        }));
    }
}
// Export singleton instance
export const orderRepository = new OrderRepository();
//# sourceMappingURL=order.repository.js.map