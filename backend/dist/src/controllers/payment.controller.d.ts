import { Request, Response } from 'express';
export declare class PaymentController {
    /** Initiate a PhonePe payment for an order → returns redirectUrl. */
    initiatePayment: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /** Confirm a PhonePe payment via server-to-server status check. */
    verifyPhonePePayment: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /** Retry payment for a PLACED order (FAILED/INITIATED payment). */
    retryPayment: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getPaymentDetails: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
export declare const paymentController: PaymentController;
//# sourceMappingURL=payment.controller.d.ts.map