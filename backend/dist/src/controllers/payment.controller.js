import { paymentService } from '../services/payment.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
export class PaymentController {
    /** Initiate a PhonePe payment for an order → returns redirectUrl. */
    initiatePayment = asyncHandler(async (req, res) => {
        const { orderId, platform } = req.body;
        const userId = req.user.userId;
        const result = await paymentService.initiatePayment(userId, orderId, platform);
        res.status(200).json({ success: true, data: result });
    });
    /** Confirm a PhonePe payment via server-to-server status check. */
    verifyPhonePePayment = asyncHandler(async (req, res) => {
        const { orderId } = req.body;
        const userId = req.user.userId;
        const result = await paymentService.verifyPhonePePayment(userId, orderId);
        res.status(200).json({ success: true, data: result });
    });
    /** Retry payment for a PLACED order (FAILED/INITIATED payment). */
    retryPayment = asyncHandler(async (req, res) => {
        const orderId = req.params.orderId;
        const userId = req.user.userId;
        const platform = req.body?.platform;
        if (!orderId)
            throw new Error('Order ID required');
        const result = await paymentService.retryPayment(userId, orderId, platform);
        res.status(200).json({ success: true, data: result });
    });
    getPaymentDetails = asyncHandler(async (req, res) => {
        const { orderId } = req.params;
        const userId = req.user.userId;
        if (!orderId)
            throw new Error('Order ID required');
        const payment = await paymentService.getPaymentDetails(orderId, userId);
        res.status(200).json({ success: true, data: payment });
    });
}
export const paymentController = new PaymentController();
//# sourceMappingURL=payment.controller.js.map