import { Router } from 'express';
import { fastrrController } from '../controllers/fastrr.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
/**
 * Shiprocket Checkout (Fastrr) Routes
 * Base path: /v1/fastrr
 *
 * Buyer-facing only. The inbound order webhook is not here — it goes through the
 * shared /v1/webhooks/:provider entry point, which is public by design.
 */
export const fastrrRouter = Router();
fastrrRouter.use(authenticate);
fastrrRouter.use(authorize('USER'));
/** POST /v1/fastrr/checkout/token — open the overlay. */
fastrrRouter.post('/checkout/token', (req, res, next) => fastrrController.createToken(req, res, next));
/** GET /v1/fastrr/checkout/sessions/:sessionId — how did it end? */
fastrrRouter.get('/checkout/sessions/:sessionId', (req, res, next) => fastrrController.getSessionStatus(req, res, next));
//# sourceMappingURL=fastrr.routes.js.map