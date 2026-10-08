/**
 * Commission Rule Controller
 * HTTP handlers for commission rule admin endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import { commissionRuleService } from '../services/commissionRule.service.js';
import { createCommissionRuleSchema, updateCommissionRuleSchema } from '../validators/commissionRule.validation.js';

export const commissionRuleController = {
    /**
     * GET /v1/admin/commission-rules
     */
    listRules: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { sellerId, categoryId, isActive } = req.query;
            const filters: { sellerId?: string; categoryId?: string; isActive?: boolean } = {};
            if (typeof sellerId === 'string') filters.sellerId = sellerId;
            if (typeof categoryId === 'string') filters.categoryId = categoryId;
            if (isActive === 'true') filters.isActive = true;
            if (isActive === 'false') filters.isActive = false;
            const result = await commissionRuleService.listRules(filters);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /v1/admin/commission-rules
     */
    createRule: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const validated = createCommissionRuleSchema.parse(req.body);
            const rule = await commissionRuleService.createRule(validated);
            res.status(201).json({ message: 'Commission rule created', rule });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /v1/admin/commission-rules/:id
     */
    updateRule: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            const validated = updateCommissionRuleSchema.parse(req.body);
            const rule = await commissionRuleService.updateRule(id, validated);
            res.json({ message: 'Commission rule updated', rule });
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /v1/admin/commission-rules/:id
     */
    deleteRule: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = req.params['id'] as string;
            await commissionRuleService.deleteRule(id);
            res.json({ message: 'Commission rule deleted' });
        } catch (error) {
            next(error);
        }
    },
};
