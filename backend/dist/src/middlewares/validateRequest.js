import { ZodError } from 'zod';
import { ApiError } from '../errors/ApiError.js';
export const validateRequest = (schema) => {
    return async (req, _res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                // Format Zod errors
                const errorMessage = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
                next(new ApiError(400, errorMessage));
            }
            else {
                next(error);
            }
        }
    };
};
//# sourceMappingURL=validateRequest.js.map