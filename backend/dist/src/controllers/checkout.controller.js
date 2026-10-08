import { checkoutService } from '../services/checkout.service.js';
import { paymentService } from '../services/payment.service.js';
import { paymentLogger } from '../config/logger.js';
/**
 * Checkout Controller
 *
 * Places the order (PLACED) and, when `withPayment=1`, initiates a PhonePe
 * payment and returns its redirectUrl. The order is confirmed only after the
 * payment succeeds (verify endpoint / webhook). If payment initiation fails,
 * the order is returned without payment so the client can retry via
 * /v1/payments/initiate; an unpaid order is swept by cancelStaleOrders.
 */
export class CheckoutController {
    async checkout(req, res, next) {
        try {
            const userId = req.user.userId;
            const { couponCode, variantIds, ...shipping } = req.body ?? {};
            const result = await checkoutService.checkout(userId, shipping, couponCode, variantIds);
            const withPayment = req.query.withPayment === '1';
            if (!withPayment) {
                res.status(201).json(result);
                return;
            }
            const platform = String(req.query.platform ?? '').toUpperCase() === 'MOBILE'
                ? 'MOBILE'
                : 'WEB';
            try {
                const payment = await paymentService.initiatePayment(userId, result.order.id, platform);
                res.status(201).json({ ...result, payment });
            }
            catch (paymentError) {
                paymentLogger.error({
                    event: 'checkout_payment_init_failed',
                    orderId: result.order.id,
                    error: paymentError instanceof Error ? paymentError.message : String(paymentError),
                }, 'Payment initiation failed during checkout');
                res.status(201).json({
                    ...result,
                    payment: null,
                    paymentInitError: paymentError instanceof Error ? paymentError.message : 'Payment initialization failed',
                });
            }
        }
        catch (error) {
            next(error);
        }
    }
}
export const checkoutController = new CheckoutController();
//# sourceMappingURL=checkout.controller.js.map