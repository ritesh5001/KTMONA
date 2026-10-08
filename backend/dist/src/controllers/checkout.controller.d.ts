import type { Request, Response, NextFunction } from 'express';
/**
 * Checkout Controller
 *
 * Places the order (PLACED) and, when `withPayment=1`, initiates a PhonePe
 * payment and returns its redirectUrl. The order is confirmed only after the
 * payment succeeds (verify endpoint / webhook). If payment initiation fails,
 * the order is returned without payment so the client can retry via
 * /v1/payments/initiate; an unpaid order is swept by cancelStaleOrders.
 */
export declare class CheckoutController {
    checkout(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const checkoutController: CheckoutController;
//# sourceMappingURL=checkout.controller.d.ts.map