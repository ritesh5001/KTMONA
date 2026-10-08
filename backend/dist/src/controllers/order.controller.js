import { orderService } from '../services/order.service.js';
import { generateInvoicePDF, recordInvoiceDownload } from '../services/invoice.service.js';
function parsePositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1)
        return fallback;
    return Math.trunc(n);
}
function parseDate(value) {
    if (typeof value !== 'string' || !value.trim())
        return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
}
/**
 * Order Controller
 * Handles HTTP requests for order viewing (buyer and seller)
 */
export class OrderController {
    // =========================================================================
    // BUYER METHODS
    // =========================================================================
    /**
     * List buyer's orders
     * GET /v1/orders
     */
    async listBuyerOrders(req, res, next) {
        try {
            const userId = req.user.userId;
            const page = parsePositiveInt(req.query['page'], 1);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const startDate = parseDate(req.query['startDate']);
            const endDate = parseDate(req.query['endDate']);
            const result = await orderService.listBuyerOrders(userId, {
                page,
                limit,
                ...(startDate ? { startDate } : {}),
                ...(endDate ? { endDate } : {}),
            });
            res.set('Cache-Control', 'no-store');
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get buyer's order detail
     * GET /v1/orders/:id
     */
    async getBuyerOrder(req, res, next) {
        try {
            const userId = req.user.userId;
            const orderId = req.params.id;
            const result = await orderService.getBuyerOrder(orderId, userId);
            res.set('Cache-Control', 'no-store');
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Download GST-compliant invoice PDF
     * GET /v1/orders/:id/invoice
     */
    async downloadInvoice(req, res, next) {
        try {
            const userId = req.user.userId;
            const orderId = req.params.id;
            // Verify the order belongs to the requesting user
            const order = await orderService.getBuyerOrder(orderId, userId);
            if (!order) {
                res.status(404).json({ message: 'Order not found' });
                return;
            }
            const pdfBuffer = await generateInvoicePDF(orderId);
            recordInvoiceDownload();
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="invoice-${orderId}.pdf"`,
                'Content-Length': pdfBuffer.length.toString(),
            });
            res.send(pdfBuffer);
        }
        catch (error) {
            next(error);
        }
    }
    // =========================================================================
    // SELLER METHODS
    // =========================================================================
    /**
     * List seller's order items
     * GET /v1/seller/orders
     */
    async listSellerOrders(req, res, next) {
        try {
            const sellerId = req.user.userId;
            const page = parsePositiveInt(req.query['page'], 1);
            const limit = parsePositiveInt(req.query['limit'], 20);
            const startDate = parseDate(req.query['startDate']);
            const endDate = parseDate(req.query['endDate']);
            const result = await orderService.listSellerOrders(sellerId, {
                page,
                limit,
                ...(startDate ? { startDate } : {}),
                ...(endDate ? { endDate } : {}),
            });
            res.set('Cache-Control', 'no-store');
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get seller's order detail
     * GET /v1/seller/orders/:id
     */
    async getSellerOrder(req, res, next) {
        try {
            const sellerId = req.user.userId;
            const orderId = req.params.id;
            const result = await orderService.getSellerOrder(orderId, sellerId);
            res.set('Cache-Control', 'no-store');
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
}
// Export singleton instance
export const orderController = new OrderController();
//# sourceMappingURL=order.controller.js.map