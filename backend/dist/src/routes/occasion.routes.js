import { Router } from 'express';
import { occasionController } from '../controllers/occasion.controller.js';
/**
 * Occasion Routes (Public)
 * Base path: /v1/occasions
 */
const occasionRouter = Router();
/**
 * GET /v1/occasions
 * List all active occasions
 */
occasionRouter.get('/', occasionController.listOccasions);
export { occasionRouter };
//# sourceMappingURL=occasion.routes.js.map