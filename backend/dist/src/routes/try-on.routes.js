import { Router } from 'express';
import { tryOnController } from '../controllers/tryOn.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
/**
 * Try-on Routes
 * Base path: /v1/try-on
 */
export const tryOnRouter = Router();
tryOnRouter.post('/', authenticate, tryOnController.create);
//# sourceMappingURL=try-on.routes.js.map