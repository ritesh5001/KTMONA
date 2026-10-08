import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors/ApiError.js';
import { fashnTryOnService } from '../services/fashnTryOn.service.js';
import { createTryOnSchema } from '../validators/tryOn.validation.js';

export class TryOnController {
    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const payload = createTryOnSchema.parse({ body: req.body }).body;
            const result = await fashnTryOnService.createTryOn(payload);
            res.set('Cache-Control', 'no-store');
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    acc[err.path.join('.')] = err.message;
                    return acc;
                }, {} as Record<string, string>);
                next(ApiError.badRequest('Validation failed', details));
                return;
            }
            next(error);
        }
    };
}

export const tryOnController = new TryOnController();
