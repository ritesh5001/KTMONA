import type { Request, Response, NextFunction } from 'express';
import { checkoutService } from '../services/checkout.service.js';
import { paymentService } from '../services/payment.service.js';
import { paymentLogger } from '../config/logger.js';

/**
 * Checkout Controller
 *
 * Places the order (PLACED) and, when `withPayment=1`, creates the Razorpay
 * order and returns the Checkout options. The order is confirmed only after the
 * payment succeeds (verify endpoint / webhook). If payment initiation fails,
 * the order is returned without payment so the client can retry via
 * /v1/payments/initiate; an unpaid order is swept by cancelStaleOrders.
 */
export class CheckoutController {
    async checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const { couponCode, variantIds, paymentMethod, checkoutKey, ...shipping } = req.body ?? {};
            const method = paymentMethod === 'COD' ? 'COD' : 'ONLINE';
            const result = await checkoutService.checkout(userId, shipping, couponCode, variantIds, method, checkoutKey);

            const withPayment = req.query.withPayment === '1';
            // COD orders are already confirmed: there is nothing to pay now. A repeat
            // submit of an order that is already paid has nothing to pay either.
            const alreadySettled = result.duplicate && result.order.status !== 'PLACED';
            if (!withPayment || result.paymentMethod === 'COD' || alreadySettled) {
                res.status(201).json(result);
                return;
            }

            try {
                const payment = await paymentService.initiatePayment(userId, result.order.id);
                res.status(201).json({ ...result, payment });
            } catch (paymentError) {
                paymentLogger.error(
                    {
                        event: 'checkout_payment_init_failed',
                        orderId: result.order.id,
                        error: paymentError instanceof Error ? paymentError.message : String(paymentError),
                    },
                    'Payment initiation failed during checkout',
                );
                res.status(201).json({
                    ...result,
                    payment: null,
                    paymentInitError:
                        paymentError instanceof Error ? paymentError.message : 'Payment initialization failed',
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Full price breakup for the cart (or buy-now selection) without placing
     * anything: items, MRP savings, coupon, GST, delivery, free-delivery progress,
     * payable total and any stock/availability problems.
     * POST /v1/checkout/quote
     */
    async quote(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { couponCode, variantIds, paymentMethod } = req.body ?? {};
            const result = await checkoutService.quote(req.user!.userId, {
                couponCode,
                variantIds,
                paymentMethod: paymentMethod === 'COD' ? 'COD' : 'ONLINE',
            });
            res.set('Cache-Control', 'no-store');
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
}

export const checkoutController = new CheckoutController();
