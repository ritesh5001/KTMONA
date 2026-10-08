import { Router } from 'express';
import { liveController } from '../controllers/live.controller.js';
export const liveRouter = Router();
// Auth is validated inside controller to support Authorization header and query-token fallback for EventSource.
liveRouter.get('/events', liveController.events);
//# sourceMappingURL=live.routes.js.map