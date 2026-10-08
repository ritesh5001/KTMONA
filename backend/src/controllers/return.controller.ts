import type { NextFunction, Request, Response } from 'express';
import { ReturnStatus } from '@prisma/client';
import { z } from 'zod';
import { returnService } from '../services/return.service.js';

const requestReturnSchema = z.object({
    reason: z.string().min(3).max(500),
    items: z.array(z.object({
        orderItemId: z.string().min(1),
        quantity: z.number().int().min(1),
        reason: z.string().max(500).optional(),
    })).min(1, 'At least one item must be specified'),
});

const rejectReturnSchema = z.object({
    reason: z.string().min(3).max(500).optional(),
});

const adminReturnListSchema = z.object({
    status: z.nativeEnum(ReturnStatus).optional(),
    userId: z.string().optional(),
    orderId: z.string().optional(),
});

export class ReturnController {
    /**
     * POST /v1/returns/:orderId
     */
    async requestReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const orderId = req.params.orderId as string;
            const payload = requestReturnSchema.parse(req.body);
            const result = await returnService.requestReturn(userId, orderId, payload.reason, payload.items);
            res.status(201).json({ return: result });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /v1/returns/my
     */
    async getMyReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const result = await returnService.getMyReturns(userId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /v1/returns/:id
     */
    async getReturnById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const returnId = req.params.id as string;
            const result = await returnService.getReturnById(userId, returnId);
            res.json({ return: result });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /v1/returns (admin)
     */
    async listReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const query = adminReturnListSchema.parse(req.query);
            const filters: {
                status?: ReturnStatus;
                userId?: string;
                orderId?: string;
            } = {};

            if (query.status !== undefined) filters.status = query.status;
            if (query.userId !== undefined) filters.userId = query.userId;
            if (query.orderId !== undefined) filters.orderId = query.orderId;

            const result = await returnService.listReturns(filters);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /v1/returns/:id/approve
     */
    async approveReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const adminId = req.user!.userId;
            const returnId = req.params.id as string;
            const result = await returnService.approveReturn(adminId, returnId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /v1/returns/:id/reject
     */
    async rejectReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const adminId = req.user!.userId;
            const returnId = req.params.id as string;
            const payload = rejectReturnSchema.parse(req.body ?? {});
            const result = await returnService.rejectReturn(adminId, returnId, payload.reason);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /v1/returns/:id/refund
     */
    async processRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const adminId = req.user!.userId;
            const returnId = req.params.id as string;
            const result = await returnService.processReturnRefund(adminId, returnId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
}

export const returnController = new ReturnController();
