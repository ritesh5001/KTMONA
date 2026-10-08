import { Router } from 'express';
import { supportController } from '../controllers/support.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const supportRouter = Router();

// Every support route is participant-scoped; the service decides whether the
// caller is the requester or an admin.
supportRouter.use(authenticate);

// GET /v1/support/unread - Badge counts for the caller's own side
supportRouter.get('/unread', supportController.unreadSummary);

// GET  /v1/support/tickets     - Requester sees their own, admins see all
// POST /v1/support/tickets     - Buyer or seller raises a ticket
supportRouter.get('/tickets', supportController.listTickets);
supportRouter.post('/tickets', supportController.createTicket);

// GET   /v1/support/tickets/:id           - Ticket header
// PATCH /v1/support/tickets/:id           - Admin status / assignment
supportRouter.get('/tickets/:id', supportController.getTicket);
supportRouter.patch('/tickets/:id', supportController.updateTicket);

// GET  /v1/support/tickets/:id/messages   - Paginated history (newest last)
// POST /v1/support/tickets/:id/messages   - Reply
supportRouter.get('/tickets/:id/messages', supportController.listMessages);
supportRouter.post('/tickets/:id/messages', supportController.sendMessage);

// POST /v1/support/tickets/:id/read       - Clear the caller's unread counter
supportRouter.post('/tickets/:id/read', supportController.markRead);

export { supportRouter };
