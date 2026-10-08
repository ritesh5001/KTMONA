import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller.js';
const router = Router();
// Public — verified by the provider's signature/authorization.
router.post('/:provider', webhookController.handleWebhook);
export const webhookRoutes = router;
//# sourceMappingURL=webhook.routes.js.map