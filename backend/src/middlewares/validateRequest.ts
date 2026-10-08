
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../errors/ApiError.js';

export const validateRequest = (schema: AnyZodObject) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Format Zod errors
                const errorMessage = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
                next(new ApiError(400, errorMessage));
            } else {
                next(error);
            }
        }
    };
};
