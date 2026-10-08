import { Prisma, OrderStatus, RefundStatus, ReturnStatus, SettlementStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { getFromCache, setCache } from '../utils/cache.util.js';
/**
 * Seller Analytics Service
 *
 * Provides aggregated analytics data for seller dashboards:
 *   - Summary KPIs (revenue, orders, refunds, rates)
 *   - Revenue over time (daily / weekly / monthly)
 *   - Top products by units sold
 *   - Inventory health (low stock, out of stock, fast movers)
 *   - Refund impact (total refunds, most-returned products)
 *
 * All heavy queries are cached in Redis for 5 minutes.
 */
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function round2(n) {
    return Math.round(n * 100) / 100;
}
// 20 minutes. Seller analytics is a reporting surface, not a live dashboard —
// a five-minute window meant almost every visit re-ran five aggregate queries
// against a cold database. Invalidated explicitly on order/settlement writes.
const CACHE_TTL = 1200;
function dateCacheSegment(d) {
    return d ? d.toISOString() : '_';
}
// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------
class SellerAnalyticsService {
    // ── 1. Dashboard Summary ─────────────────────────────────────────────
    async getSummary(sellerId, startDate, endDate) {
        const cacheKey = `seller:analytics:summary:${sellerId}:${dateCacheSegment(startDate)}:${dateCacheSegment(endDate)}`;
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        // Build optional date filter for related order
        const createdAtFilter = {};
        if (startDate)
            createdAtFilter.gte = startDate;
        if (endDate)
            createdAtFilter.lte = endDate;
        const hasDate = Object.keys(createdAtFilter).length > 0;
        const orderDateFilter = hasDate ? { createdAt: createdAtFilter } : {};
        const sellerOrderFilter = {
            items: { some: { sellerId } },
            ...orderDateFilter,
        };
        // Exclude cancelled orders from revenue / units / order-count
        const activeStatusFilter = {
            order: {
                status: { notIn: [OrderStatus.CANCELLED] },
                ...orderDateFilter,
            },
        };
        // ── Batch 1: aggregates ──────────────────────────────────────────
        const [settlementAgg, orderItemAgg, groupedOrderStatus] = await Promise.all([
            prisma.sellerSettlement.aggregate({
                where: {
                    sellerId,
                    status: { not: SettlementStatus.CANCELLED },
                    ...activeStatusFilter,
                },
                _sum: { grossAmount: true, netAmount: true },
            }),
            prisma.orderItem.aggregate({
                where: { sellerId, ...activeStatusFilter },
                _sum: { quantity: true },
            }),
            prisma.order.groupBy({
                by: ['status'],
                where: sellerOrderFilter,
                _count: { _all: true },
            }),
        ]);
        const statusCountMap = new Map(groupedOrderStatus.map((row) => [row.status, row._count._all]));
        const totalOrders = Array.from(statusCountMap.values()).reduce((sum, count) => sum + count, 0);
        const totalRevenue = settlementAgg._sum.grossAmount ?? 0;
        const netRevenue = settlementAgg._sum.netAmount ?? 0;
        const unitsSold = orderItemAgg._sum.quantity ?? 0;
        const activeOrders = totalOrders - (statusCountMap.get(OrderStatus.CANCELLED) ?? 0);
        const aov = activeOrders > 0 ? totalRevenue / activeOrders : 0;
        if (totalOrders === 0) {
            const empty = {
                totalRevenue: 0,
                totalOrders: 0,
                totalUnitsSold: 0,
                averageOrderValue: 0,
                totalRefundAmount: 0,
                netRevenue: 0,
                returnRate: 0,
                cancellationRate: 0,
                conversionRate: 0,
            };
            await setCache(cacheKey, empty, CACHE_TTL);
            return empty;
        }
        // ── Batch 2: refunds, statuses, returns ─────────────────────────
        const [refundAgg, returnCount] = await Promise.all([
            prisma.refund.aggregate({
                where: {
                    status: RefundStatus.SUCCESS,
                    order: sellerOrderFilter,
                },
                _sum: { amount: true },
            }),
            prisma.returnRequest.count({
                where: {
                    status: { in: [ReturnStatus.APPROVED, ReturnStatus.REFUNDED] },
                    order: sellerOrderFilter,
                },
            }),
        ]);
        const refundAmountRupees = (refundAgg._sum.amount ?? 0) / 100;
        const delivered = statusCountMap.get(OrderStatus.DELIVERED) ?? 0;
        const cancelled = statusCountMap.get(OrderStatus.CANCELLED) ?? 0;
        const returnRate = delivered > 0 ? (returnCount / delivered) * 100 : 0;
        const cancellationRate = totalOrders > 0 ? (cancelled / totalOrders) * 100 : 0;
        const result = {
            totalRevenue: round2(totalRevenue),
            totalOrders,
            totalUnitsSold: unitsSold,
            averageOrderValue: round2(aov),
            totalRefundAmount: round2(refundAmountRupees),
            netRevenue: round2(netRevenue),
            returnRate: round2(returnRate),
            cancellationRate: round2(cancellationRate),
            conversionRate: 0, // no tracking table available
        };
        await setCache(cacheKey, result, CACHE_TTL);
        return result;
    }
    // ── 2. Revenue Over Time ─────────────────────────────────────────────
    async getRevenueChart(sellerId, interval) {
        const cacheKey = `seller:analytics:chart:${sellerId}:${interval}`;
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        // Raw SQL group expression — interval is validated by Zod enum
        let truncExpr;
        switch (interval) {
            case 'daily':
                truncExpr = "DATE(o.created_at)";
                break;
            case 'weekly':
                truncExpr = "DATE_TRUNC('week', o.created_at)::date";
                break;
            case 'monthly':
                truncExpr = "DATE_TRUNC('month', o.created_at)::date";
                break;
        }
        const rows = await prisma.$queryRawUnsafe(`SELECT ${truncExpr} AS date,
                    COALESCE(SUM(ss.gross_amount), 0)::float AS revenue
             FROM seller_settlements ss
             JOIN orders o ON ss.order_id = o.id
             WHERE ss.seller_id = $1
               AND o.status IN ('CONFIRMED', 'DELIVERED')
               AND ss.status != 'CANCELLED'
             GROUP BY 1
             ORDER BY 1 ASC`, sellerId);
        const result = rows.map((r) => ({
            date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
            revenue: Number(r.revenue),
        }));
        await setCache(cacheKey, result, CACHE_TTL);
        return result;
    }
    // ── 3. Top Products ──────────────────────────────────────────────────
    async getTopProducts(sellerId, limit = 10) {
        const safeLimit = Math.min(20, Math.max(1, Math.trunc(limit || 10)));
        const cacheKey = `seller:analytics:top-products:${sellerId}:${safeLimit}`;
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const productAggs = await prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
                sellerId,
                order: { status: { notIn: [OrderStatus.CANCELLED] } },
            },
            _sum: { quantity: true, totalAmount: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: safeLimit,
        });
        if (productAggs.length === 0) {
            await setCache(cacheKey, [], CACHE_TTL);
            return [];
        }
        const productIds = productAggs.map((p) => p.productId);
        const [products, reviewAggs, returnCounts] = await Promise.all([
            prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, title: true, images: true },
            }),
            prisma.review.groupBy({
                by: ['productId'],
                where: { productId: { in: productIds } },
                _avg: { rating: true },
            }),
            prisma.$queryRaw `
                SELECT oi.product_id AS "productId",
                       COUNT(DISTINCT ri.return_request_id) AS "returnCount"
                FROM order_items oi
                JOIN return_items ri ON ri.order_item_id = oi.id
                WHERE oi.seller_id = ${sellerId}
                  AND oi.product_id IN (${Prisma.join(productIds)})
                GROUP BY oi.product_id
            `,
        ]);
        const prodMap = new Map(products.map((p) => [p.id, p]));
        const ratingMap = new Map(reviewAggs.map((r) => [r.productId, r._avg.rating ?? 0]));
        const returnMap = new Map(returnCounts.map((r) => [r.productId, Number(r.returnCount)]));
        const result = productAggs.map((agg) => {
            const p = prodMap.get(agg.productId);
            return {
                productId: agg.productId,
                title: p?.title ?? 'Unknown Product',
                image: p?.images?.[0] ?? null,
                unitsSold: agg._sum.quantity ?? 0,
                revenue: round2(agg._sum.totalAmount ?? 0),
                returnCount: returnMap.get(agg.productId) ?? 0,
                ratingAverage: round2(ratingMap.get(agg.productId) ?? 0),
            };
        });
        await setCache(cacheKey, result, CACHE_TTL);
        return result;
    }
    // ── 4. Inventory Health ──────────────────────────────────────────────
    async getInventoryHealth(sellerId) {
        const cacheKey = `seller:analytics:inventory:${sellerId}`;
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const [lowStockCount, outOfStockCount, totalVariants, fastMovingAggs] = await Promise.all([
            prisma.productVariant.count({
                where: {
                    product: { sellerId },
                    inventory: { stock: { gt: 0, lt: 10 } },
                },
            }),
            prisma.productVariant.count({
                where: {
                    product: { sellerId },
                    inventory: { stock: 0 },
                },
            }),
            prisma.productVariant.count({
                where: { product: { sellerId } },
            }),
            prisma.orderItem.groupBy({
                by: ['productId'],
                where: {
                    sellerId,
                    order: {
                        createdAt: { gte: thirtyDaysAgo },
                        status: { notIn: [OrderStatus.CANCELLED] },
                    },
                },
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 10,
            }),
        ]);
        // Build fast mover detail map
        const fmProductIds = fastMovingAggs.map((f) => f.productId);
        const fmProducts = fmProductIds.length > 0
            ? await prisma.product.findMany({
                where: { id: { in: fmProductIds } },
                select: { id: true, title: true, images: true },
            })
            : [];
        const fmMap = new Map(fmProducts.map((p) => [p.id, p]));
        const result = {
            lowStockProducts: lowStockCount,
            outOfStockProducts: outOfStockCount,
            totalVariants,
            fastMovingProducts: fastMovingAggs
                .filter((f) => (f._sum.quantity ?? 0) >= 5)
                .map((f) => ({
                productId: f.productId,
                title: fmMap.get(f.productId)?.title ?? 'Unknown',
                image: fmMap.get(f.productId)?.images?.[0] ?? null,
                unitsSold: f._sum.quantity ?? 0,
            })),
        };
        await setCache(cacheKey, result, CACHE_TTL);
        return result;
    }
    // ── 5. Refund Impact ─────────────────────────────────────────────────
    async getRefundImpact(sellerId, startDate, endDate) {
        const cacheKey = `seller:analytics:refund:${sellerId}:${dateCacheSegment(startDate)}:${dateCacheSegment(endDate)}`;
        const cached = await getFromCache(cacheKey);
        if (cached)
            return cached;
        const createdAtFilter = {};
        if (startDate)
            createdAtFilter.gte = startDate;
        if (endDate)
            createdAtFilter.lte = endDate;
        const hasDate = Object.keys(createdAtFilter).length > 0;
        const orderDateFilter = hasDate ? { createdAt: createdAtFilter } : {};
        const sellerOrderFilter = {
            items: { some: { sellerId } },
            ...orderDateFilter,
        };
        const mostReturnedQuery = `
            SELECT oi.product_id AS "productId",
                   p.title,
                   COUNT(DISTINCT ri.return_request_id) AS "returnCount",
                   COALESCE(SUM(ri.quantity * oi.price_snapshot), 0)::float AS "refundAmount"
            FROM return_items ri
            JOIN order_items oi ON ri.order_item_id = oi.id
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE oi.seller_id = $1
              ${hasDate ? 'AND o.created_at >= $2 AND o.created_at <= $3' : ''}
            GROUP BY oi.product_id, p.title
            ORDER BY "returnCount" DESC
            LIMIT 10
        `;
        const mostReturnedParams = hasDate
            ? [sellerId, createdAtFilter.gte ?? new Date('1970-01-01T00:00:00Z'), createdAtFilter.lte ?? new Date()]
            : [sellerId];
        const [refundAgg, mostReturned] = await Promise.all([
            prisma.refund.aggregate({
                where: {
                    status: RefundStatus.SUCCESS,
                    order: sellerOrderFilter,
                },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.$queryRawUnsafe(mostReturnedQuery, ...mostReturnedParams),
        ]);
        const result = {
            totalRefunds: refundAgg._count,
            refundRevenueImpact: round2((refundAgg._sum.amount ?? 0) / 100),
            mostReturnedProducts: mostReturned.map((r) => ({
                productId: r.productId,
                title: r.title,
                returnCount: Number(r.returnCount),
                refundAmount: round2(Number(r.refundAmount)),
            })),
        };
        await setCache(cacheKey, result, CACHE_TTL);
        return result;
    }
}
export const sellerAnalyticsService = new SellerAnalyticsService();
//# sourceMappingURL=sellerAnalytics.service.js.map