import type { Request, Response, NextFunction } from 'express';
import { bestsellerService } from '../services/bestseller.service.js';

export const bestsellerController = {
    /**
     * GET /v1/bestsellers
     */
    list: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const limitParam = req.query['limit'];
            const limit = limitParam ? Number(limitParam) : undefined;
            const audienceRaw = req.query['audience'];
            const audience =
                typeof audienceRaw === 'string' && (audienceRaw.toUpperCase() === 'MENS' || audienceRaw.toUpperCase() === 'KIDS')
                    ? (audienceRaw.toUpperCase() as 'MENS' | 'KIDS')
                    : undefined;
            const result = await bestsellerService.listPublic(limit, audience);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    },
};
