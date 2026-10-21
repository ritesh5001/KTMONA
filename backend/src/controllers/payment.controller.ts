
import { Request, Response } from 'express';
import { z } from 'zod';
import { paymentService } from '../services/payment.service.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

const verifySchema = z.object({
    orderId: z.string().min(1),
    // Present after Checkout succeeds; absent for a plain status check.
    razorpayPaymentId: z.string().min(1).optional(),
    razorpaySignature: z.string().min(1).optional(),
});

export class PaymentController {

    /** Start (or resume) a Razorpay payment for an order → Checkout options. */
    initiatePayment = asyncHandler(async (req: Request, res: Response) => {
        const { orderId } = req.body;
        const userId = (req as any).user.userId;
        const result = await paymentService.initiatePayment(userId, orderId);
        res.status(200).json({ success: true, data: result });
    });

    /** Confirm a Razorpay payment (Checkout return, or a status check). */
    verifyRazorpayPayment = asyncHandler(async (req: Request, res: Response) => {
        const input = verifySchema.parse(req.body);
        const userId = (req as any).user.userId;
        const result = await paymentService.verifyRazorpayPayment(userId, input);
        res.status(200).json({ success: true, data: result });
    });

    /** Retry payment for a PLACED order (FAILED/INITIATED payment). */
    retryPayment = asyncHandler(async (req: Request, res: Response) => {
        const orderId = req.params.orderId as string;
        const userId = (req as any).user.userId;
        if (!orderId) throw new Error('Order ID required');
        const result = await paymentService.retryPayment(userId, orderId);
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
