
import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

export class PaymentController {

    /** Initiate a PhonePe payment for an order → returns redirectUrl. */
    initiatePayment = asyncHandler(async (req: Request, res: Response) => {
        const { orderId, platform } = req.body;
        const userId = (req as any).user.userId;
        const result = await paymentService.initiatePayment(userId, orderId, platform);
        res.status(200).json({ success: true, data: result });
    });

    /** Confirm a PhonePe payment via server-to-server status check. */
    verifyPhonePePayment = asyncHandler(async (req: Request, res: Response) => {
        const { orderId } = req.body;
        const userId = (req as any).user.userId;
        const result = await paymentService.verifyPhonePePayment(userId, orderId);
        res.status(200).json({ success: true, data: result });
    });

    /** Retry payment for a PLACED order (FAILED/INITIATED payment). */
    retryPayment = asyncHandler(async (req: Request, res: Response) => {
        const orderId = req.params.orderId as string;
        const userId = (req as any).user.userId;
        const platform = req.body?.platform;
        if (!orderId) throw new Error('Order ID required');
        const result = await paymentService.retryPayment(userId, orderId, platform);
        res.status(200).json({ success: true, data: result });
    });

    getPaymentDetails = asyncHandler(async (req: Request, res: Response) => {
        const { orderId } = req.params;
        const userId = (req as any).user.userId;
        if (!orderId) throw new Error('Order ID required');
        const payment = await paymentService.getPaymentDetails(orderId as string, userId);
        res.status(200).json({ success: true, data: payment });
    });
}

export const paymentController = new PaymentController();
