import type { NextFunction, Request, Response } from 'express';
export declare class ReturnController {
    /**
     * POST /v1/returns/:orderId
     */
    requestReturn(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/returns/my
     */
    getMyReturns(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/returns/:id
     */
    getReturnById(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /v1/returns (admin)
     */
    listReturns(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /v1/returns/:id/approve
     */
    approveReturn(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /v1/returns/:id/reject
     */
    rejectReturn(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /v1/returns/:id/refund
     */
    processRefund(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const returnController: ReturnController;
//# sourceMappingURL=return.controller.d.ts.map