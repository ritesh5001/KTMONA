/**
 * Commission Rule Controller
 * HTTP handlers for commission rule admin endpoints
 */
import type { Request, Response, NextFunction } from 'express';
export declare const commissionRuleController: {
    /**
     * GET /v1/admin/commission-rules
     */
    listRules: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/admin/commission-rules
     */
    createRule: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * PUT /v1/admin/commission-rules/:id
     */
    updateRule: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /v1/admin/commission-rules/:id
     */
    deleteRule: (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
//# sourceMappingURL=commissionRule.controller.d.ts.map