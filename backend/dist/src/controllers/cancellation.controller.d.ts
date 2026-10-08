import type { NextFunction, Request, Response } from 'express';
export declare class CancellationController {
    /**
     * POST /v1/cancellations/:orderId
     */
    requestCancellation(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/cancellations/my
     */
    getMyCancellations(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/cancellations
     */
    listCancellations(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /v1/cancellations/:id/approve
     */
    approveCancellation(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /v1/cancellations/:id/seller-approve
     */
    sellerApproveCancellation(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /v1/cancellations/:id/reject
     */
    rejectCancellation(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const cancellationController: CancellationController;
//# sourceMappingURL=cancellation.controller.d.ts.map